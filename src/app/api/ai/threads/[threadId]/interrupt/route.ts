import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { ensureProjectAccess } from "@/lib/ai/conversations";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_LANGGRAPH_API_URL = "http://localhost:8123";
const UPSTREAM_TIMEOUT_MS = 10_000;

type ApprovalCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

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

function extractWriteApprovalCalls(state: unknown): ApprovalCall[] | null {
  if (!state || typeof state !== "object") return null;

  const candidates: unknown[] = [];
  const root = state as Record<string, unknown>;
  if (Array.isArray(root.interrupts)) candidates.push(...root.interrupts);
  if (Array.isArray(root.tasks)) {
    for (const task of root.tasks) {
      if (task && typeof task === "object" && Array.isArray((task as { interrupts?: unknown }).interrupts)) {
        candidates.push(...((task as { interrupts: unknown[] }).interrupts));
      }
    }
  }

  for (const entry of candidates) {
    if (!entry || typeof entry !== "object") continue;
    const value = (entry as { value?: unknown }).value;
    if (!value || typeof value !== "object") continue;
    const payload = value as { type?: unknown; calls?: unknown };
    if (payload.type === "write_approval_required" && Array.isArray(payload.calls)) {
      return payload.calls as ApprovalCall[];
    }
  }

  return null;
}

export const GET = withAuth(PERMISSIONS.PROJECT_LIST, async (_req, authCtx, routeCtx) => {
  const { threadId } = await routeCtx.params;
  const { activeOrganizationId, organizationRole, userId } = authCtx;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const normalizedThreadId = threadId?.trim();
  if (!normalizedThreadId) {
    return NextResponse.json({ message: "Invalid thread." }, { status: 400 });
  }

  const conversation = await prisma.aiConversation.findFirst({
    where: {
      organizationId: activeOrganizationId,
      threadId: normalizedThreadId,
      userId,
      status: "active",
    },
    select: { id: true, projectId: true },
  });

  if (!conversation) {
    return NextResponse.json({ message: "Thread not found." }, { status: 404 });
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

    const response = await fetchWithTimeout(
      `${langgraphApiUrl}/threads/${encodeURIComponent(normalizedThreadId)}/state`,
      { method: "GET", headers },
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: "LangGraph returned an error when reading thread state." },
        { status: 502 },
      );
    }

    const state = (await response.json()) as unknown;
    const calls = extractWriteApprovalCalls(state);

    if (!calls) {
      return NextResponse.json(
        { interrupted: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { interrupted: true, threadId: normalizedThreadId, calls },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { message: "Timeout connecting to LangGraph." },
        { status: 504 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === "Missing LANGGRAPH_API_KEY in production." ||
        error.message === "Missing LANGGRAPH_API_URL in production.")
    ) {
      return NextResponse.json(
        { message: "LangGraph is not configured." },
        { status: 502 },
      );
    }

    console.error("[ai-interrupt] request_failed", {
      userId,
      threadId: normalizedThreadId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { message: "Could not fetch the thread interrupt state." },
      { status: 502 },
    );
  }
});
