import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { aiApprovalRequestSchema } from "@/lib/ai/schemas";
import { ensureProjectAccess } from "@/lib/ai/conversations";
import { checkOrgQuota, extractUsageFromEvent, recordAiUsage } from "@/lib/ai/usage";
import { extractAssistantDelta, mergeAssistantChunk } from "@/lib/assistant-hub/chat-helpers";
import { getOrCreateAgentToken } from "@/lib/ai/agent-token";
import { buildLangGraphConfig } from "@/lib/ai/langgraph";

export const runtime = "nodejs";

const DEFAULT_LANGGRAPH_API_URL = "http://localhost:8123";
const DEFAULT_ASSISTANT_ID = "qa_agent";
const UPSTREAM_TIMEOUT_MS = 30_000;

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

function createHeaders(apiKey: string | null): HeadersInit {
  return apiKey
    ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
    : { "Content-Type": "application/json" };
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

type StreamState = {
  pending: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string | null;
};

function appendSseAssistantDelta(chunkText: string, state: StreamState) {
  state.pending += chunkText;
  const lines = state.pending.split("\n");
  state.pending = lines.pop() ?? "";

  for (const rawLine of lines) {
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
      if (usage.inputTokens > state.inputTokens) state.inputTokens = usage.inputTokens;
      if (usage.outputTokens > state.outputTokens) state.outputTokens = usage.outputTokens;
      if (usage.model) state.model = usage.model;
    }

    const delta = extractAssistantDelta(parsed);
    if (delta) state.content = mergeAssistantChunk(state.content, delta);
  }
}

export const POST = withAuth(PERMISSIONS.PROJECT_LIST, async (req, authCtx) => {
  const bodyJson = await req.json().catch(() => null);
  const parsed = aiApprovalRequestSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { conversationId, threadId, decision } = parsed.data;
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

  const conversation = await prisma.aiConversation.findFirst({
    where: {
      id: conversationId,
      organizationId: activeOrganizationId,
      userId,
      status: "active",
    },
    select: {
      id: true,
      threadId: true,
      projectId: true,
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { message: "You do not have access to the specified conversation." },
      { status: 403 },
    );
  }

  if (conversation.threadId !== threadId) {
    return NextResponse.json(
      { message: "The thread does not belong to this conversation." },
      { status: 403 },
    );
  }

  const hasAccess = await ensureProjectAccess({
    userId,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: conversation.projectId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to the specified project." },
      { status: 403 },
    );
  }

  try {
    const langgraphApiUrl = resolveLanggraphApiUrl();
    const langgraphApiKey = resolveLanggraphApiKey();
    const headers = createHeaders(langgraphApiKey);
    const assistantId = process.env.LANGGRAPH_QA_ID || DEFAULT_ASSISTANT_ID;

    const mtmApiToken = await getOrCreateAgentToken({
      userId,
      organizationId: activeOrganizationId,
    });

    const runResponse = await fetchWithTimeout(
      `${langgraphApiUrl}/threads/${encodeURIComponent(threadId)}/runs/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          assistant_id: assistantId,
          command: { resume: decision },
          config: buildLangGraphConfig(mtmApiToken, conversation.projectId, threadId),
          stream_mode: ["messages", "updates"],
        }),
      },
    );

    if (!runResponse.ok) {
      const details = await runResponse.text();
      console.warn("[ai-approve] upstream_error", {
        userId,
        conversationId,
        threadId,
        status: runResponse.status,
      });
      return NextResponse.json(
        { message: "LangGraph returned an error.", details },
        { status: 502 },
      );
    }

    if (!runResponse.body) {
      return NextResponse.json(
        { message: "No stream was received from LangGraph." },
        { status: 502 },
      );
    }

    const decoder = new TextDecoder();
    const assistantState: StreamState = {
      pending: "",
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      model: null,
    };

    const persistedStream = runResponse.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          appendSseAssistantDelta(decoder.decode(chunk, { stream: true }), assistantState);
        },
        async flush() {
          const last = decoder.decode();
          if (last) appendSseAssistantDelta(last, assistantState);

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
                data: { lastMessageAt: new Date() },
              }),
            ]);
          } catch (error) {
            console.error("[ai-approve] persist_assistant_failed", {
              conversationId,
              error: error instanceof Error ? error.message : "unknown",
            });
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
            console.error("[ai-approve] record_usage_failed", {
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
        "X-Thread-Id": threadId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { message: "Timeout connecting to LangGraph." },
        { status: 504 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Missing LANGGRAPH_API_KEY in production."
    ) {
      return NextResponse.json(
        { message: "LangGraph API key is not configured." },
        { status: 502 },
      );
    }

    console.error("[ai-approve] request_failed", {
      userId,
      conversationId,
      threadId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { message: "Could not process the approval request." },
      { status: 502 },
    );
  }
});
