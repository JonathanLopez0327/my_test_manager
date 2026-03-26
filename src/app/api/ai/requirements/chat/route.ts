import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { aiRequirementsChatRequestSchema } from "@/lib/ai/schemas";
import { getOrCreateAgentToken } from "@/lib/ai/agent-token";

export const runtime = "nodejs";

const DEFAULT_LANGGRAPH_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "requirements_agent";
const UPSTREAM_TIMEOUT_MS = 30_000;

function resolveLanggraphApiUrl(): string {
  const requirementsUrl = process.env.LANGGRAPH_REQUIREMENTS_API_URL?.trim();
  if (requirementsUrl) return requirementsUrl.replace(/\/+$/, "");

  const mainUrl = process.env.LANGGRAPH_API_URL?.trim();
  if (mainUrl) return mainUrl.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing LANGGRAPH_REQUIREMENTS_API_URL or LANGGRAPH_API_URL in production.");
  }
  return DEFAULT_LANGGRAPH_API_URL;
}

function resolveLanggraphApiKey(): string | null {
  const raw = process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY?.trim();
  if (raw) return raw;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_LANGGRAPH_API_KEY in production.");
  }
  return null;
}

function resolveAssistantId(): string {
  return (
    process.env.LANGGRAPH_ASSISTANT_REQUIREMENTS_ID?.trim() ||
    process.env.LANGGRAPH_ASSITANT_REQUIREMENTS_ID?.trim() ||
    DEFAULT_ASSISTANT_ID
  );
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

export const POST = withAuth(PERMISSIONS.PROJECT_LIST, async (req, authCtx) => {
  const bodyJson = await req.json().catch(() => null);
  const parsed = aiRequirementsChatRequestSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { message, projectId, threadId: clientThreadId } = parsed.data;
  const { userId, activeOrganizationId } = authCtx;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  try {
    const langgraphApiUrl = resolveLanggraphApiUrl();
    const langgraphApiKey = resolveLanggraphApiKey();
    const headers = createHeaders(langgraphApiKey);
    const assistantId = resolveAssistantId();

    const mtmApiToken = await getOrCreateAgentToken({
      userId,
      organizationId: activeOrganizationId,
    });

    let activeThreadId = clientThreadId?.trim() || null;

    if (!activeThreadId) {
      const threadResponse = await fetchWithTimeout(`${langgraphApiUrl}/threads`, {
        method: "POST",
        headers,
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
    }

    const runResponse = await fetchWithTimeout(
      `${langgraphApiUrl}/threads/${encodeURIComponent(activeThreadId)}/runs/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          assistant_id: assistantId,
          input: {
            messages: [{ role: "user", content: message }],
          },
          config: {
            configurable: {
              project_id: projectId,
              mtm_api_token: mtmApiToken,
            },
          },
          stream_mode: "messages",
        }),
      },
    );

    if (!runResponse.ok) {
      const details = await runResponse.text();
      console.warn("[requirements-chat] upstream_error", {
        userId,
        projectId,
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

    return new NextResponse(runResponse.body as ReadableStream, {
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
        { message: "Timeout connecting to LangGraph." },
        { status: 504 },
      );
    }

    console.error("[requirements-chat] request_failed", {
      userId,
      projectId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { message: "Could not process the requirements request." },
      { status: 502 },
    );
  }
});
