import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { aiChatRequestSchema } from "@/lib/ai/schemas";
import { getOrCreateAgentToken } from "@/lib/ai/agent-token";
import { ensureProjectAccess } from "@/lib/ai/conversations";

export const runtime = "nodejs";

const DEFAULT_LANGGRAPH_API_URL = "http://localhost:8123";
const DEFAULT_ASSISTANT_ID = "mtm_agent";
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
  const raw = process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY?.trim();
  if (raw) return raw;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_LANGGRAPH_API_KEY in production.");
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

function appendSseAssistantDelta(chunkText: string, state: { pending: string; content: string }) {
  state.pending += chunkText;
  const lines = state.pending.split("\n");
  state.pending = lines.pop() ?? "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    try {
      const parsed = JSON.parse(data) as unknown;
      const delta = extractAssistantDelta(parsed);
      if (!delta) continue;
      state.content = mergeAssistantChunk(state.content, delta);
    } catch {
      continue;
    }
  }
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
    const assistantId = process.env.LANGGRAPH_ASSISTANT_ID || DEFAULT_ASSISTANT_ID;

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
          config: {
            configurable: {
              project_id: projectId,
              mtm_api_token: mtmApiToken,
              ...(entityContext ? { entity_context: entityContext } : {}),
            },
          },
          stream_mode: "messages",
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
    const assistantState = { pending: "", content: "" };

    const persistedStream = runResponse.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          const chunkText = decoder.decode(chunk, { stream: true });
          appendSseAssistantDelta(chunkText, assistantState);
        },
        async flush() {
          const lastText = decoder.decode();
          if (lastText) {
            appendSseAssistantDelta(lastText, assistantState);
          }

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

    if (error instanceof Error && error.message === "Missing NEXT_PUBLIC_LANGGRAPH_API_KEY in production.") {
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


