import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { aiChatRequestSchema } from "@/lib/ai/schemas";
import { getOrCreateAgentToken } from "@/lib/ai/agent-token";
import { ensureProjectAccess } from "@/lib/ai/conversations";
import { checkOrgQuota, extractUsageFromEvent, recordAiUsage } from "@/lib/ai/usage";
import { buildLangGraphConfig } from "@/lib/ai/langgraph";

export const runtime = "nodejs";

const DEFAULT_LANGGRAPH_API_URL = "http://localhost:8123";
const DEFAULT_ASSISTANT_ID = "qa_agent";
const UPSTREAM_TIMEOUT_MS = 30_000;

type ApprovalCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

function extractApprovalInterrupt(parsed: unknown): ApprovalCall[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const event = parsed as Record<string, unknown>;
  const candidates = [event.__interrupt__, (event.data as Record<string, unknown> | undefined)?.__interrupt__];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const first = candidate[0] as { value?: { type?: string; calls?: ApprovalCall[] } } | undefined;
    if (first?.value?.type === "write_approval_required" && Array.isArray(first.value.calls)) {
      return first.value.calls;
    }
  }
  return null;
}

function resolveLanggraphApiUrl(): string {
  const raw = process.env.LANGGRAPH_API_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing LANGGRAPH_API_URL in production.");
    }
    return DEFAULT_LANGGRAPH_API_URL;
  }
  return raw.replace(/\/+$/, "");
}

function resolveLanggraphApiKey(): string | null {
  const raw = process.env.LANGGRAPH_API_KEY?.trim();
  if (raw) return raw;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing LANGGRAPH_API_KEY in production.");
  }

  return null;
}

function createLanggraphHeaders(apiKey: string | null): HeadersInit {
  return apiKey
    ? {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }
    : {
      "Content-Type": "application/json",
    };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractAssistantDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const event = payload as Record<string, unknown>;
  if (event.type === "AIMessageChunk" || event.type === "ai") {
    const content = event.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const chunk = part as Record<string, unknown>;
          if (typeof chunk.text === "string") return chunk.text;
          return "";
        })
        .join("");
    }
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => extractAssistantDelta(item)).join("");
  }

  if (Array.isArray(event.content)) {
    return event.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const chunk = part as Record<string, unknown>;
        if (typeof chunk.text === "string") return chunk.text;
        return "";
      })
      .join("");
  }

  return "";
}

function getOverlapSize(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) return size;
  }
  return 0;
}

function mergeAssistantChunk(current: string, incoming: string): string {
  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming === current) return current;
  if (incoming.startsWith(current)) return incoming;
  if (current.startsWith(incoming)) return current;
  if (incoming.includes(current)) return incoming;
  if (current.includes(incoming)) return current;

  const overlap = getOverlapSize(current, incoming);
  return current + incoming.slice(overlap);
}

function titleFromPrompt(prompt: string) {
  return prompt.trim().slice(0, 56) || "New conversation";
}

type StreamState = {
  pending: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string | null;
  interrupted: boolean;
};

function processFrameStats(frame: string, state: StreamState) {
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      continue;
    }

    const usage = extractUsageFromEvent(parsed);
    if (usage) {
      // Keep the largest observed counts — providers emit partial then final totals.
      if (usage.inputTokens > state.inputTokens) state.inputTokens = usage.inputTokens;
      if (usage.outputTokens > state.outputTokens) state.outputTokens = usage.outputTokens;
      if (usage.model) state.model = usage.model;
    }

    const delta = extractAssistantDelta(parsed);
    if (delta) state.content = mergeAssistantChunk(state.content, delta);
  }
}

function findApprovalInFrame(frame: string): ApprovalCall[] | null {
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const calls = extractApprovalInterrupt(JSON.parse(data) as unknown);
      if (calls) return calls;
    } catch {
      continue;
    }
  }
  return null;
}

export const POST = withAuth(PERMISSIONS.PROJECT_LIST, async (req, authCtx) => {
  const startedAt = Date.now();
  const bodyJson = await req.json().catch(() => null);
  const parsed = aiChatRequestSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { message, projectId: explicitProjectId, conversationId, entityContext } = parsed.data;
  const { userId, activeOrganizationId, organizationRole } = authCtx;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const quota = await checkOrgQuota(activeOrganizationId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        message: "AI token quota exceeded for this billing period.",
        used: quota.used.toString(),
        limit: quota.limit,
        periodEnd: quota.periodEnd.toISOString(),
      },
      { status: 402 },
    );
  }

  // Look up the conversation first — projectId may come from it when not provided
  const conversation = await prisma.aiConversation.findFirst({
    where: {
      id: conversationId,
      ...(explicitProjectId ? { projectId: explicitProjectId } : {}),
      organizationId: activeOrganizationId,
      userId,
      status: "active",
    },
    select: {
      id: true,
      threadId: true,
      title: true,
      environment: true,
      projectId: true,
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { message: "You do not have access to the specified conversation." },
      { status: 403 },
    );
  }

  const projectId = explicitProjectId ?? conversation.projectId;

  const hasAccess = await ensureProjectAccess({
    userId,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to the specified project." },
      { status: 403 },
    );
  }

  const now = new Date();
  const nextTitle = titleFromPrompt(message);

  await prisma.$transaction([
    prisma.aiConversationMessage.create({
      data: {
        conversation: { connect: { id: conversationId } },
        role: "user",
        content: message,
      },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        title: conversation.title === "New conversation" ? nextTitle : conversation.title,
      },
    }),
  ]);

  try {
    const langgraphApiUrl = resolveLanggraphApiUrl();
    const langgraphApiKey = resolveLanggraphApiKey();
    const langgraphHeaders = createLanggraphHeaders(langgraphApiKey);
    const assistantId = process.env.LANGGRAPH_QA_ID || DEFAULT_ASSISTANT_ID;

    const mtmApiToken = await getOrCreateAgentToken({
      userId,
      organizationId: activeOrganizationId,
    });

    let activeThreadId = conversation.threadId;
    if (!activeThreadId) {
      const threadResponse = await fetchWithTimeout(`${langgraphApiUrl}/threads`, {
        method: "POST",
        headers: langgraphHeaders,
        body: JSON.stringify({}),
      });

      if (!threadResponse.ok) {
        const details = await threadResponse.text();
        return NextResponse.json(
          { message: "Could not create the AI thread.", details },
          { status: 502 },
        );
      }

      const threadData = (await threadResponse.json()) as { thread_id?: string };
      activeThreadId = threadData.thread_id ?? null;
      if (!activeThreadId) {
        return NextResponse.json(
          { message: "Invalid response when creating the thread." },
          { status: 502 },
        );
      }

      await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { threadId: activeThreadId },
      });
    }

    const runResponse = await fetchWithTimeout(
      `${langgraphApiUrl}/threads/${encodeURIComponent(activeThreadId)}/runs/stream`,
      {
        method: "POST",
        headers: langgraphHeaders,
        body: JSON.stringify({
          assistant_id: assistantId,
          input: {
            messages: [{ role: "user", content: message }],
          },
          config: buildLangGraphConfig(mtmApiToken, projectId, activeThreadId, {
            entityContext,
          }),
          stream_mode: ["messages", "updates"],
        }),
      },
    );

    if (!runResponse.ok) {
      const details = await runResponse.text();
      console.warn("[ai-chat] upstream_error", {
        userId,
        projectId,
        conversationId,
        threadId: activeThreadId,
        status: runResponse.status,
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { message: "LangGraph devolvio un error.", details },
        { status: 502 },
      );
    }

    if (!runResponse.body) {
      return NextResponse.json(
        { message: "No stream was received from LangGraph." },
        { status: 502 },
      );
    }

    console.info("[ai-chat] stream_started", {
      userId,
      projectId,
      conversationId,
      threadId: activeThreadId,
      status: 200,
      elapsedMs: Date.now() - startedAt,
    });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const assistantState: StreamState = {
      pending: "",
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      model: null,
      interrupted: false,
    };

    const persistedStream = runResponse.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          if (assistantState.interrupted) return;

          assistantState.pending += decoder.decode(chunk, { stream: true });
          const frames = assistantState.pending.split("\n\n");
          assistantState.pending = frames.pop() ?? "";

          for (const frame of frames) {
            if (!frame) continue;

            const approvalCalls = findApprovalInFrame(frame);
            if (approvalCalls) {
              const approvalPayload = JSON.stringify({
                calls: approvalCalls,
                thread_id: activeThreadId,
              });
              controller.enqueue(
                encoder.encode(`event: approval_required\ndata: ${approvalPayload}\n\n`),
              );
              assistantState.interrupted = true;
              return;
            }

            controller.enqueue(encoder.encode(`${frame}\n\n`));
            processFrameStats(frame, assistantState);
          }
        },
        async flush(controller) {
          const lastText = decoder.decode();
          if (lastText) assistantState.pending += lastText;

          if (!assistantState.interrupted && assistantState.pending.trim()) {
            const tail = assistantState.pending;
            assistantState.pending = "";

            const approvalCalls = findApprovalInFrame(tail);
            if (approvalCalls) {
              controller.enqueue(
                encoder.encode(
                  `event: approval_required\ndata: ${JSON.stringify({
                    calls: approvalCalls,
                    thread_id: activeThreadId,
                  })}\n\n`,
                ),
              );
              assistantState.interrupted = true;
            } else {
              controller.enqueue(encoder.encode(`${tail}\n\n`));
              processFrameStats(tail, assistantState);
            }
          }

          // When interrupted we skip writing a placeholder assistant row —
          // the resume stream (/api/ai/approve) persists the real reply.
          if (!assistantState.interrupted) {
            const assistantContent =
              assistantState.content || "No assistant content was returned for this request.";

            try {
              await prisma.$transaction([
                prisma.aiConversationMessage.create({
                  data: {
                    conversation: { connect: { id: conversationId } },
                    role: "assistant",
                    content: assistantContent,
                  },
                }),
                prisma.aiConversation.update({
                  where: { id: conversationId },
                  data: {
                    lastMessageAt: new Date(),
                  },
                }),
              ]);
            } catch (error) {
              console.error("[ai-chat] persist_assistant_failed", {
                conversationId,
                error: error instanceof Error ? error.message : "unknown",
              });
            }
          }

          try {
            await recordAiUsage({
              organizationId: activeOrganizationId,
              userId,
              conversationId,
              source: "chat",
              model: assistantState.model,
              inputTokens: assistantState.inputTokens,
              outputTokens: assistantState.outputTokens,
            });
          } catch (error) {
            console.error("[ai-chat] record_usage_failed", {
              conversationId,
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        },
      }),
    );

    return new NextResponse(persistedStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Thread-Id": activeThreadId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { message: "Timeout al conectar con LangGraph." },
        { status: 504 },
      );
    }

    if (error instanceof Error && error.message === "Missing LANGGRAPH_API_KEY in production.") {
      console.error("[ai-chat] missing_langgraph_api_key", {
        userId,
        projectId,
        conversationId,
      });

      return NextResponse.json(
        { message: "LangGraph API key is not configured." },
        { status: 502 },
      );
    }

    console.error("[ai-chat] request_failed", {
      userId,
      projectId,
      conversationId,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { message: "Could not process the assistant request." },
      { status: 502 },
    );
  }
});


