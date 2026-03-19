"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlert,
  IconChevronDown,
  IconChevronUp,
  IconDocument,
  IconDownload,
  IconExternalLink,
  IconPlus,
  IconSend,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import type { AiConversationDto, AiConversationsResponse } from "@/components/ai-chat/types";
import { cn } from "@/lib/utils";

type ProjectAiChatPanelProps = {
  projectId: string;
  projectName: string;
  className?: string;
};

type QuickAction = {
  id: string;
  label: string;
  template: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "explain-failing-run",
    label: "Explain failing run",
    template: "Explain why run #{{id}} failed and suggest next steps.",
  },
  {
    id: "generate-test-cases",
    label: "Generate test cases",
    template: "Generate test cases for: {{feature}}",
  },
  {
    id: "summarize-run",
    label: "Summarize run",
    template: "Summarize run #{{id}} for stakeholders in 5 bullets.",
  },
  {
    id: "create-bug",
    label: "Create bug",
    template: "Create a bug report from failed test {{testId}} in run #{{id}}.",
  },
  {
    id: "analyze-flaky-tests",
    label: "Analyze flaky tests",
    template: "Analyze flaky tests in {{project}} and suggest stabilization steps.",
  },
];

function insertTemplate(currentDraft: string, template: string) {
  const incoming = template.trim();
  if (!incoming) return currentDraft;

  const base = currentDraft.trimEnd();
  if (!base) return incoming;

  return `${base}\n${incoming}`;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ThreadDocumentApiResponse =
  | {
      status: "missing";
    }
  | {
      status: "pending";
    }
  | {
      status: "ready";
      url: string;
      filename: string;
    };

type ThreadDocumentState =
  | {
      status: "missing";
      message: string;
    }
  | {
      status: "pending";
      message: string;
    }
  | {
      status: "ready";
      url: string;
      filename: string;
    }
  | {
      status: "error";
      message: string;
    };

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

function tryParseAssistantPayload(raw: string): string | null {
  const parseCandidate = (value: string): string | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const payload = parsed as Record<string, unknown>;
      if (typeof payload.markdown === "string") return payload.markdown;
      const structured = payload.structured_response;
      if (structured && typeof structured === "object") {
        const structuredPayload = structured as Record<string, unknown>;
        if (typeof structuredPayload.markdown === "string") {
          return structuredPayload.markdown;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = parseCandidate(raw);
  if (direct) return direct;

  const objectStart = raw.indexOf("{");
  if (objectStart >= 0) {
    const fromObject = parseCandidate(raw.slice(objectStart));
    if (fromObject) return fromObject;
  }

  const escapedStart = raw.indexOf('\\"markdown\\"');
  if (escapedStart >= 0) {
    const candidate = raw.slice(Math.max(0, escapedStart - 2));
    const unescaped = candidate.replace(/\\"/g, '"');
    const fromEscaped = parseCandidate(unescaped);
    if (fromEscaped) return fromEscaped;
  }

  return null;
}

function normalizeAssistantContent(raw: string): string {
  const content = raw.trim();
  if (!content) return raw;

  const markdown = tryParseAssistantPayload(content);
  if (markdown) {
    return markdown
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }

  if (content.includes('"structured_response"') || content.includes('"markdown"')) {
    return "";
  }

  return raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function mapConversationMessages(conversation: AiConversationDto): ChatMessage[] {
  return conversation.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.role === "assistant" ? normalizeAssistantContent(message.content) : message.content,
    createdAt: message.createdAt,
  }));
}

/**
 * Project-level AI chat with streaming responses and no history sidebar.
 * It loads the latest active thread for the selected project and continues it.
 */
export function ProjectAiChatPanel({
  projectId,
  projectName,
  className,
}: ProjectAiChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDocumentSectionOpen, setIsDocumentSectionOpen] = useState(false);
  const [documentState, setDocumentState] = useState<ThreadDocumentState>({
    status: "missing",
    message: "No generated document available yet.",
  });
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const fetchThreadDocument = useCallback(async (threadId: string) => {
    if (!threadId) return;

    setDocumentState({
      status: "pending",
      message: "Checking generated document status...",
    });

    try {
      const response = await fetch(`/api/ai-chat/threads/${encodeURIComponent(threadId)}/document`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Could not fetch the generated document.");
      }

      const payload = (await response.json()) as ThreadDocumentApiResponse;
      if (unmountedRef.current) return;

      if (payload.status === "ready") {
        setDocumentState({
          status: "ready",
          url: payload.url,
          filename: payload.filename,
        });
        return;
      }

      if (payload.status === "pending") {
        setDocumentState({
          status: "pending",
          message: "The document is still generating. Retry in a few seconds.",
        });
        return;
      }

      setDocumentState({
        status: "missing",
        message: "No generated document available for this conversation.",
      });
    } catch (documentError) {
      if (unmountedRef.current) return;
      setDocumentState({
        status: "error",
        message:
          documentError instanceof Error
            ? documentError.message
            : "Could not fetch the generated document.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadLatestConversation = async () => {
      setIsLoadingConversation(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/ai/conversations?projectId=${encodeURIComponent(projectId)}`,
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message || "Could not load project chat.");
        }

        const payload = (await response.json()) as AiConversationsResponse;
        if (!active) return;

        const latest = payload.items[0] ?? null;
        if (!latest) {
          setActiveConversationId(null);
          setActiveThreadId(null);
          setDocumentState({
            status: "missing",
            message: "No generated document available yet.",
          });
          setMessages([]);
          return;
        }

        setActiveConversationId(latest.id);
        setMessages(mapConversationMessages(latest));
        const threadId = latest.threadId?.trim() || null;
        setActiveThreadId(threadId);
        if (threadId) {
          void fetchThreadDocument(threadId);
        } else {
          setDocumentState({
            status: "missing",
            message: "No generated document available for this conversation.",
          });
        }
      } catch (loadError) {
        if (!active) return;
        setActiveConversationId(null);
        setActiveThreadId(null);
        setDocumentState({
          status: "error",
          message: "Could not load generated document status.",
        });
        setMessages([]);
        setError(loadError instanceof Error ? loadError.message : "Could not load project chat.");
      } finally {
        if (active) setIsLoadingConversation(false);
      }
    };

    void loadLatestConversation();
    return () => {
      active = false;
    };
  }, [projectId, fetchThreadDocument]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const createConversation = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Could not create conversation.");
      }

      const payload = (await response.json()) as { item: AiConversationDto };
      setActiveConversationId(payload.item.id);
      const threadId = payload.item.threadId?.trim() || null;
      setActiveThreadId(threadId);
      if (threadId) {
        void fetchThreadDocument(threadId);
      } else {
        setDocumentState({
          status: "missing",
          message: "No generated document available for this conversation.",
        });
      }
      setMessages(mapConversationMessages(payload.item));
      setError(null);
      return payload.item.id;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create conversation.");
      return null;
    }
  };

  const handleCreateNewChat = async () => {
    if (isSending || isLoadingConversation) return;

    setDraft("");
    setMessages([]);
    setError(null);
    setActiveConversationId(null);
    setActiveThreadId(null);
    setDocumentState({
      status: "missing",
      message: "No generated document available yet.",
    });

    await createConversation();
    promptRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) return;
    }

    setError(null);
    setDraft("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const placeholderAssistantId = `a-stream-${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: placeholderAssistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          projectId,
          conversationId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "We could not generate a response right now.");
      }

      if (!response.body) {
        throw new Error("The AI response stream is empty.");
      }

      const streamedThreadId = response.headers.get("X-Thread-Id")?.trim() || null;
      let nextThreadId = activeThreadId;
      if (streamedThreadId) {
        nextThreadId = streamedThreadId;
        setActiveThreadId(streamedThreadId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let assistantRawContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as unknown;
            const delta = extractAssistantDelta(parsed);
            if (!delta) continue;
            assistantRawContent = mergeAssistantChunk(assistantRawContent, delta);
            const liveContent = normalizeAssistantContent(assistantRawContent);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === placeholderAssistantId
                  ? { ...message, content: liveContent }
                  : message,
              ),
            );
          } catch {
            continue;
          }
        }
      }

      const normalized = normalizeAssistantContent(assistantRawContent).trim();
      const finalContent = normalized || "No assistant content was returned for this request.";
      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderAssistantId
            ? { ...message, content: finalContent }
            : message,
        ),
      );

      if (nextThreadId) {
        void fetchThreadDocument(nextThreadId);
      } else {
        setDocumentState({
          status: "missing",
          message: "No generated document available for this conversation.",
        });
      }
    } catch (sendError) {
      const nextError =
        sendError instanceof Error
          ? sendError.message
          : "We could not generate a response right now.";
      setError(nextError);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderAssistantId
            ? {
              ...message,
              content: "Error communicating with the assistant.",
            }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending]);

  return (
    <section className={`flex h-full w-full min-h-0 flex-col overflow-hidden rounded-xl border border-stroke bg-surface-muted/30 p-6 ${className ?? ""}`.trim()}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Project Assistant</p>
          <p className="text-xs text-ink-muted">Chat in context for {projectName}.</p>
        </div>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => void handleCreateNewChat()}
          aria-label="Crear nuevo chat"
          disabled={isSending || isLoadingConversation}
          className="gap-1.5"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Nuevo chat
        </Button>
      </header>

      <div
        ref={viewportRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-dashed border-stroke bg-surface/70 px-6 py-5"
      >
        {isLoadingConversation ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-xl space-y-3">
              <div className="h-4 w-36 animate-pulse rounded-md bg-surface-muted" />
              <div className="h-16 w-[72%] animate-pulse rounded-2xl bg-surface-muted" />
              <div className="ml-auto h-14 w-[58%] animate-pulse rounded-2xl bg-brand-100/70" />
              <div className="h-20 w-[84%] animate-pulse rounded-2xl bg-surface-muted" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-base font-semibold text-ink">Start an AI chat for this project</p>
              <p className="mt-1 text-sm text-ink-muted">
                Ask about {projectName}, test runs, bugs, suites, or quality trends.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-brand-600 text-white"
                      : "border border-stroke bg-surface text-ink",
                  )}
                >
                  {message.role === "assistant" && message.content.trim().length === 0 ? (
                    <div className="inline-flex items-center gap-2 text-ink-muted">
                      {/* <span className="text-xs font-medium uppercase tracking-[0.08em]">
                        Thinking
                      </span> */}
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" />
                      </span>
                    </div>
                  ) : message.role === "assistant" ? (
                    <MarkdownContent content={message.content} className="text-ink" />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </article>
            ))}

          </div>
        )}
      </div>

      <section
        className="mt-4 shrink-0 rounded-xl border border-stroke bg-surface px-4 py-3"
        data-testid="project-generated-document"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconDocument className="h-4 w-4 text-brand-600" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Generated document
            </p>
          </div>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setIsDocumentSectionOpen((current) => !current)}
            aria-label={isDocumentSectionOpen ? "Collapse generated document" : "Expand generated document"}
            className="gap-1 text-[11px] text-ink-muted"
          >
            {isDocumentSectionOpen ? (
              <>
                <IconChevronUp className="h-3 w-3" />
                Collapse
              </>
            ) : (
              <>
                <IconChevronDown className="h-3 w-3" />
                Expand
              </>
            )}
          </Button>
        </div>

        {!isDocumentSectionOpen ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {documentState.status === "ready"
                ? `PDF ready: ${documentState.filename}`
                : documentState.message}
            </p>
            {documentState.status !== "ready" && activeThreadId ? (
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => void fetchThreadDocument(activeThreadId)}
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : documentState.status === "ready" ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-ink">{documentState.filename}</p>
              <div className="flex items-center gap-1.5">
                <a
                  href={documentState.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                >
                  <IconExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
                <a
                  href={documentState.url}
                  download={documentState.filename}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>

            <iframe
              src={documentState.url}
              title={`Generated PDF ${documentState.filename}`}
              className="h-72 w-full rounded-lg border border-stroke bg-white"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-stroke bg-surface-elevated p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
                <p className="text-xs text-ink-muted">{documentState.message}</p>
              </div>
              {activeThreadId ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => void fetchThreadDocument(activeThreadId)}
                >
                  Reintentar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <div className="mt-4 shrink-0 flex flex-wrap gap-1.5" data-testid="project-chat-quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.id}
            type="button"
            size="xs"
            variant="quiet"
            onClick={() => {
              setDraft((currentDraft) => insertTemplate(currentDraft, action.template));
              setError(null);
            }}
            className="h-7 rounded-full border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {action.label}
          </Button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-3 shrink-0"
        data-testid="project-chat-composer"
      >
        {error ? (
          <div className="mb-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-xs font-medium text-danger-600">
            {error}
          </div>
        ) : null}

        <label htmlFor="project-ai-prompt" className="sr-only">
          Prompt message
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-stroke bg-surface px-3 py-2.5">
          <textarea
            id="project-ai-prompt"
            ref={promptRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about this project..."
            rows={1}
            className="max-h-40 w-full resize-y bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 w-9 rounded-xl p-0 text-white"
            disabled={!canSend}
            aria-label="Send message"
          >
            <IconSend className="h-5 w-5 shrink-0 text-white fill-white stroke-white" />
          </Button>
        </div>
      </form>
    </section>
  );
}
