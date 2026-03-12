"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconChevronDown,
  IconChevronUp,
  IconClipboard,
  IconDocument,
  IconDownload,
  IconExternalLink,
  IconPlus,
  IconSearch,
  IconSend,
  IconAlert,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { Modal } from "@/components/ui/Modal";
import type { OrganizationsResponse } from "@/components/organizations/types";
import type { ProjectsResponse } from "@/components/projects/types";
import type {
  AiConversationDto,
  AiConversationsResponse,
  AiConversationMessageDto,
} from "@/components/ai-chat/types";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "assistant";

type AssistantMessageMetadata = {
  type?: string;
  sources?: string[];
  suggestions?: string[];
  [key: string]: unknown;
};

type AssistantDocumentVersion = {
  version?: number;
  url: string;
  generatedAt?: string;
  testCaseCount?: number;
  changeSummary?: string;
};

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  metadata?: AssistantMessageMetadata | null;
  documentVersions?: AssistantDocumentVersion[];
  threadId?: string | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  scopeLabel?: string;
  environment?: string;
  threadId?: string | null;
};

type AssistantContext = {
  workspace: string;
  projectId: string;
  environment: string;
  stats: {
    projects: string;
    runs: string;
    openBugs: string;
  };
};

type ProjectOption = {
  id: string;
  label: string;
};

type BugsStatsResponse = {
  byStatus?: {
    open?: number;
  };
};

type RunsResponse = {
  total?: number;
};

type QuickAction = {
  id: string;
  label: string;
  template: string;
};

type AttachmentItem = {
  id: string;
  name: string;
  size: number;
  type: string;
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
    }
  | {
      status: "pending";
    }
  | {
      status: "ready";
      url: string;
      filename: string;
    }
  | {
      status: "timeout";
      message: string;
    }
  | {
      status: "error";
      message: string;
  };

type ConversationGeneratedAttachment = {
  id: string;
  filename: string;
  url: string;
  source: "thread" | "message";
  createdAt?: string;
};

const FALLBACK_WORKSPACE = "Software Sushi";
const ENV_OPTIONS = ["DEV", "STAGING", "PROD"];
const DOCUMENT_POLL_INTERVAL_MS = 2500;
const DOCUMENT_POLL_MAX_ATTEMPTS = 12;

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

const ATTACHMENT_HELPERS = [
  { id: "attachment-summarize", label: "Summarize", prefix: "Summarize the attached evidence" },
  { id: "attachment-errors", label: "Extract errors", prefix: "Extract errors from the attached evidence" },
  { id: "attachment-next-steps", label: "Next steps", prefix: "Suggest next steps based on the attached evidence" },
] as const;

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

function tryParseAssistantPayload(
  raw: string,
): {
  markdown: string;
  metadata: AssistantMessageMetadata | null;
  documentVersions: AssistantDocumentVersion[];
} | null {
  const parseCandidate = (
    value: string,
  ):
    | {
        markdown: string;
        metadata: AssistantMessageMetadata | null;
        documentVersions: AssistantDocumentVersion[];
      }
    | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const payload = parsed as Record<string, unknown>;

      const normalizeDocumentVersions = (candidate: unknown): AssistantDocumentVersion[] => {
        if (!Array.isArray(candidate)) return [];

        return candidate.reduce<AssistantDocumentVersion[]>((acc, item) => {
          if (!item || typeof item !== "object") return acc;
          const value = item as Record<string, unknown>;
          if (typeof value.url !== "string" || !value.url.trim()) return acc;

          acc.push({
            version: typeof value.version === "number" ? value.version : undefined,
            url: value.url,
            generatedAt: typeof value.generated_at === "string" ? value.generated_at : undefined,
            testCaseCount: typeof value.test_case_count === "number" ? value.test_case_count : undefined,
            changeSummary: typeof value.change_summary === "string" ? value.change_summary : undefined,
          });
          return acc;
        }, []);
      };

      const documentVersions = normalizeDocumentVersions(payload.document_versions);

      if (typeof payload.markdown === "string") {
        const metadata =
          payload.metadata && typeof payload.metadata === "object"
            ? (payload.metadata as AssistantMessageMetadata)
            : null;
        return { markdown: payload.markdown, metadata, documentVersions };
      }

      const structured = payload.structured_response;
      if (structured && typeof structured === "object") {
        const structuredPayload = structured as Record<string, unknown>;
        if (typeof structuredPayload.markdown === "string") {
          const metadata =
            structuredPayload.metadata && typeof structuredPayload.metadata === "object"
              ? (structuredPayload.metadata as AssistantMessageMetadata)
              : null;
          return { markdown: structuredPayload.markdown, metadata, documentVersions };
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
  const parsed = tryParseAssistantPayload(content);
  if (parsed?.markdown) {
    return parsed.markdown
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }
  if (content.includes('"structured_response"') || content.includes('"markdown"')) {
    return "";
  }
  return raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function normalizeAssistantMetadata(raw: string): AssistantMessageMetadata | null {
  const content = raw.trim();
  if (!content) return null;
  const parsed = tryParseAssistantPayload(content);
  return parsed?.metadata ?? null;
}

function normalizeAssistantDocumentVersions(raw: string): AssistantDocumentVersion[] {
  const content = raw.trim();
  if (!content) return [];
  const parsed = tryParseAssistantPayload(content);
  return parsed?.documentVersions ?? [];
}

function titleFromPrompt(prompt: string) {
  return prompt.trim().slice(0, 56) || "New conversation";
}

function formatTime(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "recently";

  const diffMs = Date.now() - value.getTime();
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function insertTemplate(currentDraft: string, template: string) {
  const incoming = template.trim();
  if (!incoming) return currentDraft;

  const base = currentDraft.trimEnd();
  if (!base) return incoming;

  return `${base}\n${incoming}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapMessageDto(
  message: AiConversationMessageDto,
  threadId?: string | null,
): ChatMessage {
  const parsedMetadata = message.role === "assistant" ? normalizeAssistantMetadata(message.content) : null;
  const parsedDocuments =
    message.role === "assistant" ? normalizeAssistantDocumentVersions(message.content) : [];

  return {
    id: message.id,
    role: message.role,
    content: message.role === "assistant" ? normalizeAssistantContent(message.content) : message.content,
    metadata: parsedMetadata,
    documentVersions: parsedDocuments,
    threadId: message.role === "assistant" ? threadId ?? null : null,
    createdAt: message.createdAt,
  };
}

function mapConversationDto(
  conversation: AiConversationDto,
  scopeLabel: string,
): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessageAt: conversation.lastMessageAt,
    scopeLabel,
    environment: conversation.environment,
    threadId: conversation.threadId ?? null,
  };
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  return conversations.reduce(
    (acc, conversation) => {
      const createdAt = new Date(conversation.lastMessageAt);
      if (Number.isNaN(createdAt.getTime())) {
        acc.yesterday.push(conversation);
        return acc;
      }

      if (isSameLocalDate(createdAt, now)) {
        acc.today.push(conversation);
      } else if (isSameLocalDate(createdAt, yesterday)) {
        acc.yesterday.push(conversation);
      } else {
        acc.yesterday.push(conversation);
      }

      return acc;
    },
    { today: [] as Conversation[], yesterday: [] as Conversation[] },
  );
}

function formatDocumentGeneratedAt(timestamp?: string): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
/**
 * QA Assistant workspace with chat thread, context controls, and SSE streaming responses.
 */
export function AiChatWorkspace() {
  const { data: session } = useSession();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const workspaceSelectRef = useRef<HTMLSelectElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const pollingThreadsRef = useRef<Set<string>>(new Set());
  const unmountedRef = useRef(false);
  const checkedThreadsRef = useRef<Set<string>>(new Set());

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [threadDocuments, setThreadDocuments] = useState<Record<string, ThreadDocumentState>>({});
  const [expandedAttachmentId, setExpandedAttachmentId] = useState<string | null>(null);
  const [attachmentsPanelOpen, setAttachmentsPanelOpen] = useState(false);

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([
    { id: "all", label: "All projects" },
    { id: "web-app", label: "Web App" },
    { id: "mobile-app", label: "Mobile App" },
  ]);

  const [assistantContext, setAssistantContext] = useState<AssistantContext>({
    workspace: FALLBACK_WORKSPACE,
    projectId: "all",
    environment: "DEV",
    stats: {
      projects: "--",
      runs: "--",
      openBugs: "--",
    },
  });

  const [contextDraft, setContextDraft] = useState({
    workspace: FALLBACK_WORKSPACE,
    projectId: "all",
    environment: "DEV",
  });

  useEffect(() => {
    setContextDraft({
      workspace: assistantContext.workspace,
      projectId: assistantContext.projectId,
      environment: assistantContext.environment,
    });
  }, [assistantContext]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
      try {
        const [orgsResponse, projectsResponse, runsResponse, bugsResponse] = await Promise.all([
          fetch("/api/organizations"),
          fetch("/api/projects?page=1&pageSize=50&query="),
          fetch("/api/test-runs?page=1&pageSize=1&query="),
          fetch("/api/bugs/stats"),
        ]);

        const [orgsData, projectsData, runsData, bugsData] = await Promise.all([
          orgsResponse.ok ? orgsResponse.json() : Promise.resolve(null),
          projectsResponse.ok ? projectsResponse.json() : Promise.resolve(null),
          runsResponse.ok ? runsResponse.json() : Promise.resolve(null),
          bugsResponse.ok ? bugsResponse.json() : Promise.resolve(null),
        ]);

        if (!active) return;

        const organizations = (orgsData as OrganizationsResponse | null)?.items ?? [];
        const activeWorkspace = organizations.find((org) => org.id === session?.user?.activeOrganizationId)?.name;

        const projectsPayload = projectsData as ProjectsResponse | null;
        const fetchedProjects = projectsPayload?.items ?? [];
        const options: ProjectOption[] = [
          { id: "all", label: "All projects" },
          ...fetchedProjects.map((project) => ({ id: project.id, label: `${project.key} - ${project.name}` })),
        ];

        if (options.length > 1) {
          setProjectOptions(options);
        }

        const runsPayload = runsData as RunsResponse | null;
        const bugsPayload = bugsData as BugsStatsResponse | null;

        setAssistantContext((prev) => {
          const nextProjectId = options.some((project) => project.id === prev.projectId)
            ? prev.projectId
            : "all";

          return {
            ...prev,
            workspace: activeWorkspace ?? prev.workspace,
            projectId: nextProjectId,
            stats: {
              projects:
                typeof projectsPayload?.total === "number"
                  ? String(projectsPayload.total)
                  : prev.stats.projects,
              runs:
                typeof runsPayload?.total === "number"
                  ? String(runsPayload.total)
                  : prev.stats.runs,
              openBugs:
                typeof bugsPayload?.byStatus?.open === "number"
                  ? String(bugsPayload.byStatus.open)
                  : prev.stats.openBugs,
            },
          };
        });
      } catch {
        if (!active) return;
        setAssistantContext((prev) => ({ ...prev }));
      }
    };

    void loadContext();

    return () => {
      active = false;
    };
  }, [session?.user?.activeOrganizationId]);

  useEffect(() => {
    let active = true;

    const loadConversations = async () => {
      if (assistantContext.projectId === "all") {
        if (!active) return;
        setConversations([]);
        setConversationMessages({});
        setSelectedChatId("");
        return;
      }

      try {
        const response = await fetch(
          `/api/ai/conversations?projectId=${encodeURIComponent(assistantContext.projectId)}`,
        );

        if (!response.ok) {
          throw new Error("Could not load conversations.");
        }

        const payload = (await response.json()) as AiConversationsResponse;
        if (!active) return;

        const scopeLabel =
          projectOptions.find((project) => project.id === assistantContext.projectId)?.label ??
          "All projects";

        const nextConversations = payload.items.map((item) =>
          mapConversationDto(item, scopeLabel),
        );
        const nextMessages = payload.items.reduce<Record<string, ChatMessage[]>>((acc, item) => {
          acc[item.id] = item.messages.map((message) => mapMessageDto(message, item.threadId));
          return acc;
        }, {});

        setError(null);
        setConversations(nextConversations);
        setConversationMessages(nextMessages);
        setSelectedChatId((prev) =>
          prev && nextConversations.some((conversation) => conversation.id === prev)
            ? prev
            : (nextConversations[0]?.id ?? ""),
        );
      } catch {
        if (!active) return;
        setError("Could not load conversation history.");
        setConversations([]);
        setConversationMessages({});
        setSelectedChatId("");
      }
    };

    void loadConversations();

    return () => {
      active = false;
    };
  }, [assistantContext.projectId, projectOptions]);

  const filteredConversations = useMemo(() => {
    const normalized = historyQuery.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(normalized));
  }, [conversations, historyQuery]);

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations],
  );

  const selectedMessages = useMemo(
    () => conversationMessages[selectedChatId] ?? [],
    [conversationMessages, selectedChatId],
  );
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId);
  const selectedThreadId = selectedConversation?.threadId?.trim() || "";
  const selectedThreadDocumentState = selectedThreadId
    ? threadDocuments[selectedThreadId]
    : undefined;
  const userInitials = (session?.user?.name ?? "You")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const selectedProjectLabel =
    projectOptions.find((project) => project.id === assistantContext.projectId)?.label ?? "All projects";

  const isContextChanged =
    assistantContext.workspace !== contextDraft.workspace ||
    assistantContext.projectId !== contextDraft.projectId ||
    assistantContext.environment !== contextDraft.environment;

  const conversationGeneratedAttachments = useMemo<ConversationGeneratedAttachment[]>(() => {
    const fromMessages: ConversationGeneratedAttachment[] = [];

    for (const message of selectedMessages) {
      if (message.role !== "assistant" || (message.documentVersions?.length ?? 0) === 0) continue;

      message.documentVersions?.forEach((version, index) => {
        if (!version?.url?.trim()) return;
        const fallbackName = (() => {
          try {
            const pathname = new URL(version.url).pathname;
            const name = pathname.split("/").pop()?.trim();
            return name || `document-version-${index + 1}.pdf`;
          } catch {
            return `document-version-${index + 1}.pdf`;
          }
        })();

        fromMessages.push({
          id: `msg-${message.id}-${index}`,
          filename: fallbackName,
          url: version.url,
          source: "message",
          createdAt: version.generatedAt,
        });
      });
    }

    const threadAttachment =
      selectedThreadId && selectedThreadDocumentState?.status === "ready"
        ? ({
            id: `thread-${selectedThreadId}`,
            filename: selectedThreadDocumentState.filename,
            url: selectedThreadDocumentState.url,
            source: "thread",
          } satisfies ConversationGeneratedAttachment)
        : null;

    const seen = new Set<string>();
    const deduped: ConversationGeneratedAttachment[] = [];
    const ordered = threadAttachment ? [threadAttachment, ...fromMessages] : fromMessages;

    for (const attachment of ordered) {
      const key = `${attachment.url}::${attachment.filename}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(attachment);
    }

    return deduped;
  }, [selectedMessages, selectedThreadId, selectedThreadDocumentState]);

  useEffect(() => {
    if (!conversationGeneratedAttachments.some((attachment) => attachment.id === expandedAttachmentId)) {
      setExpandedAttachmentId(conversationGeneratedAttachments[0]?.id ?? null);
    }
  }, [conversationGeneratedAttachments, expandedAttachmentId]);

  useEffect(() => {
    const hasVisibleState =
      conversationGeneratedAttachments.length > 0 ||
      selectedThreadDocumentState?.status === "pending" ||
      selectedThreadDocumentState?.status === "timeout" ||
      selectedThreadDocumentState?.status === "error";

    if (hasVisibleState) {
      setAttachmentsPanelOpen(true);
    }
  }, [conversationGeneratedAttachments.length, selectedThreadDocumentState?.status]);

  const createConversation = async (): Promise<string | null> => {
    if (assistantContext.projectId === "all") {
      setError("Select a specific project before creating a conversation.");
      return null;
    }

    try {
      const response = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: assistantContext.projectId,
          environment: assistantContext.environment,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Could not create conversation.");
      }

      const payload = (await response.json()) as { item: AiConversationDto };
      const created = mapConversationDto(payload.item, selectedProjectLabel);
      const createdMessages = payload.item.messages.map((message) =>
        mapMessageDto(message, payload.item.threadId),
      );

      setConversations((prev) => [created, ...prev.filter((conversation) => conversation.id !== created.id)].slice(0, 5));
      setConversationMessages((prev) => ({ ...prev, [created.id]: createdMessages }));
      setSelectedChatId(created.id);
      setError(null);
      return created.id;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create conversation.");
      return null;
    }
  };

  const handleCreateChat = async () => {
    const createdId = await createConversation();
    if (!createdId) return;
    setDraft("");
    promptRef.current?.focus();
  };

  const appendMessage = (chatId: string, message: ChatMessage) => {
    setConversationMessages((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] ?? []), message],
    }));
  };

  const insertTemplateIntoDraft = (template: string) => {
    setDraft((prev) => insertTemplate(prev, template));
    setError(null);
    promptRef.current?.focus();
  };

  const handleEvidenceSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const next = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setAttachments((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  };

  /** Single fetch — used when switching conversations. */
  const checkThreadDocument = useCallback(async (threadId: string) => {
    if (!threadId || checkedThreadsRef.current.has(threadId)) return;
    checkedThreadsRef.current.add(threadId);

    try {
      const response = await fetch(`/api/ai-chat/threads/${encodeURIComponent(threadId)}/document`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (!unmountedRef.current) {
          setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "missing" } }));
        }
        return;
      }

      const payload = (await response.json()) as ThreadDocumentApiResponse;
      if (!unmountedRef.current) {
        if (payload.status === "ready") {
          setThreadDocuments((prev) => ({
            ...prev,
            [threadId]: { status: "ready", url: payload.url, filename: payload.filename },
          }));
        } else if (payload.status === "pending") {
          setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "pending" } }));
        } else {
          setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "missing" } }));
        }
      }
    } catch {
      if (!unmountedRef.current) {
        setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "missing" } }));
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    void checkThreadDocument(selectedThreadId);
  }, [selectedThreadId, checkThreadDocument]);

  /** Full retry loop (12 × 2.5 s) — used after handleSend stream ends. */
  const pollThreadDocumentUntilReady = useCallback(async (threadId: string) => {
    if (!threadId) return;
    if (pollingThreadsRef.current.has(threadId)) return;

    pollingThreadsRef.current.add(threadId);
    checkedThreadsRef.current.add(threadId);

    // Show spinner immediately
    if (!unmountedRef.current) {
      setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "pending" } }));
    }

    let sawPending = false;
    try {
      for (let attempt = 0; attempt < DOCUMENT_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (unmountedRef.current) return;

        const response = await fetch(`/api/ai-chat/threads/${encodeURIComponent(threadId)}/document`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const errPayload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(errPayload?.message || "Could not fetch the generated document.");
        }

        const payload = (await response.json()) as ThreadDocumentApiResponse;

        if (payload.status === "ready") {
          if (!unmountedRef.current) {
            setThreadDocuments((prev) => ({
              ...prev,
              [threadId]: { status: "ready", url: payload.url, filename: payload.filename },
            }));
          }
          return;
        }

        if (payload.status === "missing") {
          if (!unmountedRef.current) {
            setThreadDocuments((prev) => ({ ...prev, [threadId]: { status: "missing" } }));
          }
          return;
        }

        sawPending = true;
        if (attempt < DOCUMENT_POLL_MAX_ATTEMPTS - 1) {
          await sleep(DOCUMENT_POLL_INTERVAL_MS);
        }
      }
    } catch (pollError) {
      if (!unmountedRef.current) {
        setThreadDocuments((prev) => ({
          ...prev,
          [threadId]: {
            status: "error",
            message: pollError instanceof Error ? pollError.message : "Could not get the generated document.",
          },
        }));
      }
      return;
    } finally {
      pollingThreadsRef.current.delete(threadId);
    }

    if (!unmountedRef.current && sawPending) {
      setThreadDocuments((prev) => ({
        ...prev,
        [threadId]: {
          status: "timeout",
          message: "The document is not ready yet. You can retry in a few seconds.",
        },
      }));
    }
  }, []);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedChatId(conversationId);
    const conv = conversations.find((c) => c.id === conversationId);
    const tid = conv?.threadId?.trim();
    if (tid) void checkThreadDocument(tid);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;
    if (assistantContext.projectId === "all") {
      setError("Select a specific project before sending a message.");
      return;
    }

    let chatId = selectedChatId;
    if (!chatId) {
      const createdId = await createConversation();
      if (!createdId) return;
      chatId = createdId;
    }

    setError(null);
    setDraft("");
    setIsSending(true);

    const now = new Date().toISOString();

    appendMessage(chatId, {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: now,
    });

    setConversations((prev) => {
      const updated = prev.map((conversation) =>
        conversation.id === chatId
          ? {
              ...conversation,
              title: titleFromPrompt(content),
              lastMessageAt: now,
              updatedAt: now,
              scopeLabel: selectedProjectLabel,
              environment: assistantContext.environment,
            }
          : conversation,
      );

      const selected = updated.find((conversation) => conversation.id === chatId);
      const others = updated.filter((conversation) => conversation.id !== chatId);
      return selected ? [selected, ...others].slice(0, 5) : updated;
    });

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          projectId: assistantContext.projectId,
          conversationId: chatId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "We could not generate a response right now.");
      }

      if (!response.body) {
        throw new Error("The AI response stream is empty.");
      }

      const activeThreadId = response.headers.get("X-Thread-Id")?.trim() || null;
      if (activeThreadId) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === chatId
              ? { ...conversation, threadId: activeThreadId }
              : conversation,
          ),
        );
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
          } catch {
            continue;
          }
        }
      }

      const formattedContent = normalizeAssistantContent(assistantRawContent).trim();
      const assistantContent =
        formattedContent || "No assistant content was returned for this request.";
      const assistantMetadata = normalizeAssistantMetadata(assistantRawContent);
      const assistantDocumentVersions = normalizeAssistantDocumentVersions(assistantRawContent);

      appendMessage(chatId, {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        content: assistantContent,
        metadata: assistantMetadata,
        documentVersions: assistantDocumentVersions,
        threadId: activeThreadId,
        createdAt: new Date().toISOString(),
      });

      if (activeThreadId) {
        void pollThreadDocumentUntilReady(activeThreadId);
      }
    } catch (sendError) {
      const nextError =
        sendError instanceof Error ? sendError.message : "We could not generate a response right now.";
      setError(nextError);
      appendMessage(chatId, {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        content: "Error communicating with the assistant.",
        metadata: null,
        documentVersions: [],
        threadId: null,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
    } catch {
      setError("Message could not be copied.");
    }
  };

  const handleApplyContext = () => {
    setAssistantContext((prev) => ({
      ...prev,
      workspace: contextDraft.workspace || FALLBACK_WORKSPACE,
      projectId: contextDraft.projectId,
      environment: contextDraft.environment,
    }));
    setContextModalOpen(false);
  };

  return (
    <section className="h-[calc(100dvh-9.5rem)] min-h-[640px] overflow-hidden rounded-2xl border border-stroke bg-surface-elevated">
      <div className="grid h-full min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-stroke bg-surface md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-stroke px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                #
              </span>
              <div>
                <p className="text-base font-semibold text-ink">QA Assistant</p>
                <p className="text-[11px] text-ink-soft">{assistantContext.workspace}</p>
              </div>
            </div>
            <Button type="button" size="xs" variant="secondary" onClick={handleCreateChat} aria-label="New conversation">
              <IconPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="border-b border-stroke px-4 py-3">
            <Input
              type="search"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search conversations..."
              leadingIcon={<IconSearch className="h-4 w-4" />}
              aria-label="Search conversation history"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Today</p>
              <div className="space-y-1.5">
                {groupedConversations.today.map((conversation) => {
                  const relativeTime = formatRelativeTime(conversation.lastMessageAt);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      data-testid={`conversation-row-${conversation.id}`}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        selectedChatId === conversation.id
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                      title={conversation.title}
                    >
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] opacity-80">{relativeTime}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Yesterday</p>
              <div className="space-y-1.5">
                {groupedConversations.yesterday.map((conversation) => {
                  const relativeTime = formatRelativeTime(conversation.lastMessageAt);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      data-testid={`conversation-row-${conversation.id}`}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        selectedChatId === conversation.id
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                      title={conversation.title}
                    >
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] opacity-80">{relativeTime}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {filteredConversations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stroke px-3 py-4 text-sm text-ink-muted">
                No QA conversations match this search yet.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col bg-surface">
          <header className="flex items-center justify-between border-b border-stroke px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {selectedConversation?.title ?? "New conversation"}
              </p>
              <p className="truncate text-xs text-ink-soft">
                {assistantContext.workspace} / {selectedProjectLabel} / {assistantContext.environment}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted">
                Project: {selectedProjectLabel}
              </Badge>
              <Button size="xs" variant="secondary" onClick={() => setContextModalOpen(true)}>
                Change context
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
            {selectedMessages.length === 0 ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-stroke bg-surface-muted/60 px-6 text-center">
                <div>
                  <p className="text-base font-semibold text-ink">Start a QA conversation</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Ask about run failures, bug trends, flaky tests, or test case design.
                  </p>
                </div>
              </div>
            ) : (
              selectedMessages.map((message, index) => {
                const isLatestAssistantMessage =
                  message.role === "assistant" &&
                  !selectedMessages.slice(index + 1).some((candidate) => candidate.role === "assistant");

                return (
                  <article
                    key={message.id}
                    className={cn("flex items-start gap-3", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {message.role === "assistant" ? (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
                        AI
                      </span>
                    ) : null}
                    <div className="group max-w-[88%] space-y-2.5">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          message.role === "user"
                            ? "bg-brand-600 text-white"
                            : "border border-stroke bg-surface-muted text-ink",
                        )}
                      >
                        {message.role === "assistant" ? (
                          <MarkdownContent content={message.content} className="text-ink" />
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}

                        {message.role === "assistant" && isLatestAssistantMessage && conversationGeneratedAttachments.length > 0 ? (
                          <section className="mt-3 rounded-xl border border-stroke bg-surface p-2.5">
                            <p className="text-[11px] text-ink-muted">
                              Generated PDF available in the attachments section.
                            </p>
                          </section>
                        ) : null}
                      </div>
                      <div className={cn("flex items-center gap-2 px-1", message.role === "user" ? "justify-end" : "justify-between")}>
                        <p className="text-[11px] text-ink-soft">{formatTime(message.createdAt)}</p>
                        {message.role === "assistant" ? (
                          <Button
                            size="xs"
                            variant="quiet"
                            className="rounded-full border border-stroke bg-surface-elevated px-3 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                            onClick={() => handleCopy(message.content)}
                            aria-label="Copy assistant message"
                          >
                            <IconClipboard className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {message.role === "user" ? (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                        {userInitials}
                      </span>
                    ) : null}
                  </article>
                );
              })
            )}

            {isSending ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Generating response...
              </div>
            ) : null}
          </div>

          <section className="border-t border-stroke bg-surface-elevated px-4 py-3 sm:px-5">
            <div className="space-y-3 rounded-xl border border-stroke bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconDocument className="h-4 w-4 text-brand-600" />
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Attachments</p>
                  {conversationGeneratedAttachments.length > 0 ? (
                    <Badge className="px-2 py-0.5 text-[10px]">{conversationGeneratedAttachments.length}</Badge>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setAttachmentsPanelOpen((value) => !value)}
                  aria-label={attachmentsPanelOpen ? "Collapse attachmentss" : "Expand attachments"}
                  className="gap-1 text-[11px] text-ink-muted"
                >
                  {attachmentsPanelOpen ? (
                    <>
                      <IconChevronUp className="h-3 w-3" />
                      Colapsar
                    </>
                  ) : (
                    <>
                      <IconChevronDown className="h-3 w-3" />
                      Expandir
                    </>
                  )}
                </Button>
              </div>

              {!attachmentsPanelOpen ? (
                <p className="text-xs text-ink-muted">
                  {conversationGeneratedAttachments.length > 0
                    ? `${conversationGeneratedAttachments.length} PDF available.`
                    : "No PDFs were generated in this conversation."}
                </p>
              ) : null}

              {attachmentsPanelOpen && !selectedThreadId ? (
                <p className="text-xs text-ink-muted">No PDFs were generated in this conversation.</p>
              ) : null}

              {attachmentsPanelOpen && selectedThreadDocumentState?.status === "pending" ? (
                <div className="rounded-lg border border-stroke bg-surface-elevated p-3">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-40 rounded bg-surface-muted" />
                    <div className="h-20 w-full rounded bg-surface-muted" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <span className="text-xs text-ink-muted">Generando documento...</span>
                  </div>
                </div>
              ) : null}

              {attachmentsPanelOpen &&
              (selectedThreadDocumentState?.status === "timeout" || selectedThreadDocumentState?.status === "error") &&
              selectedThreadId ? (
                <div className="rounded-lg border border-stroke bg-surface-elevated p-3">
                  <div className="flex items-start gap-2">
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
                    <div className="space-y-2">
                      <p className="text-xs text-ink-muted">{selectedThreadDocumentState.message}</p>
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => {
                          checkedThreadsRef.current.delete(selectedThreadId);
                          pollingThreadsRef.current.delete(selectedThreadId);
                          void pollThreadDocumentUntilReady(selectedThreadId);
                        }}
                      >
                        Reintentar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {attachmentsPanelOpen && conversationGeneratedAttachments.length > 0 ? (
                <div className="space-y-3">
                  {conversationGeneratedAttachments.map((attachment) => {
                    const isExpanded = expandedAttachmentId === attachment.id;
                    const generatedAtLabel = formatDocumentGeneratedAt(attachment.createdAt);
                    return (
                      <article
                        key={attachment.id}
                        className="space-y-2 rounded-lg border border-stroke bg-surface-elevated p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <IconDocument className="h-4 w-4 shrink-0 text-brand-600" />
                            <span className="truncate text-sm font-semibold text-ink">{attachment.filename}</span>
                            <Badge tone="info" className="px-2 py-0.5 text-[10px]">
                              PDF
                            </Badge>
                            <Badge className="px-2 py-0.5 text-[10px]">
                              {attachment.source === "thread" ? "Último" : "Histórico"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir ${attachment.filename}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                            >
                              <IconExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                            <a
                              href={attachment.url}
                              download={attachment.filename}
                              aria-label={`Descargar ${attachment.filename}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                            >
                              <IconDownload className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </div>
                        </div>

                        {generatedAtLabel ? (
                          <p className="text-[11px] text-ink-soft">Generado {generatedAtLabel}</p>
                        ) : null}

                        {isExpanded ? (
                          <iframe
                            src={attachment.url}
                            title={`Adjunto PDF ${attachment.filename}`}
                            className="h-72 w-full rounded-lg border border-stroke bg-white"
                            loading="lazy"
                          />
                        ) : null}

                        <div className="flex justify-center">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setExpandedAttachmentId((current) =>
                                current === attachment.id ? null : attachment.id,
                              )
                            }
                            className="gap-1 text-[11px] text-ink-muted"
                          >
                            {isExpanded ? (
                              <>
                                <IconChevronUp className="h-3 w-3" />
                                Colapsar
                              </>
                            ) : (
                              <>
                                <IconChevronDown className="h-3 w-3" />
                                Expandir
                              </>
                            )}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {attachmentsPanelOpen &&
              selectedThreadId &&
              conversationGeneratedAttachments.length === 0 &&
              (!selectedThreadDocumentState ||
                selectedThreadDocumentState.status === "missing") ? (
                <p className="text-xs text-ink-muted">No PDFs were generated in this conversation.</p>
              ) : null}
            </div>
          </section>

          <form onSubmit={handleSend} className="border-t border-stroke bg-surface-elevated px-4 py-3 sm:px-5">
            {error ? (
              <div className="mb-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-xs font-medium text-danger-600">
                {error}
              </div>
            ) : null}

            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  size="xs"
                  variant="quiet"
                  onClick={() => insertTemplateIntoDraft(action.template)}
                  className="h-7 rounded-full border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  {action.label}
                </Button>
              ))}
            </div>

            {attachments.length > 0 ? (
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-stroke bg-surface px-2.5 text-xs font-medium text-ink-muted"
                    >
                      <span className="max-w-[190px] truncate">{attachment.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        onClick={() => removeAttachment(attachment.id)}
                        aria-label={`Remove evidence ${attachment.name}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ATTACHMENT_HELPERS.map((helper) => (
                    <Button
                      key={helper.id}
                      type="button"
                      size="xs"
                      variant="quiet"
                      onClick={() =>
                        insertTemplateIntoDraft(`${helper.prefix}: ${attachments[0]?.name ?? "evidence-file"}`)
                      }
                      className="h-7 rounded-full border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                      {helper.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <label htmlFor="ai-prompt" className="sr-only">
              Prompt message
            </label>
            <div className="flex items-end gap-2 rounded-xl border border-stroke bg-surface px-3 py-2.5">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => evidenceInputRef.current?.click()}
                aria-label="Attach evidence"
              >
                <IconPlus className="h-4 w-4" />
              </Button>
              <textarea
                id="ai-prompt"
                ref={promptRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about test runs, bugs, suites, or attach evidence..."
                rows={1}
                className="max-h-40 w-full resize-y bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
              />
              <Button
                type="submit"
                size="sm"
                className="h-9 w-9 rounded-xl p-0 text-white"
                disabled={isSending || draft.trim().length === 0}
                aria-label="Send message"
              >
                <IconSend className="h-5 w-5 shrink-0 text-white fill-white stroke-white" />
              </Button>
            </div>

            <input
              ref={evidenceInputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Attach evidence files"
              onChange={handleEvidenceSelected}
            />
          </form>
        </div>
      </div>
      <Modal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        title="Change assistant context"
        description="Select workspace scope and environment for QA analysis."
        size="lg"
        closeOnEsc
        trapFocus
        initialFocusRef={workspaceSelectRef}
      >
        <div className="space-y-5">
          <label className="block text-sm font-semibold text-ink">
            Workspace
            <select
              ref={workspaceSelectRef}
              value={contextDraft.workspace}
              onChange={(event) => setContextDraft((prev) => ({ ...prev, workspace: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated px-3 text-sm text-ink"
            >
              <option value={assistantContext.workspace}>{assistantContext.workspace}</option>
              <option value={FALLBACK_WORKSPACE}>{FALLBACK_WORKSPACE}</option>
            </select>
            <p className="mt-1 text-xs font-normal text-ink-soft">Select the workspace to analyze</p>
          </label>

          <label className="block text-sm font-semibold text-ink">
            Project
            <select
              value={contextDraft.projectId}
              onChange={(event) => setContextDraft((prev) => ({ ...prev, projectId: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated px-3 text-sm text-ink"
            >
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs font-normal text-ink-soft">Scope results to a project (optional)</p>
          </label>

          <label className="block text-sm font-semibold text-ink">
            Environment
            <select
              value={contextDraft.environment}
              onChange={(event) => setContextDraft((prev) => ({ ...prev, environment: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated px-3 text-sm text-ink"
            >
              {ENV_OPTIONS.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs font-normal text-ink-soft">DEV / STG / PROD</p>
          </label>

          <p className="border-t border-stroke pt-3 text-xs text-ink-soft">This will affect new assistant responses.</p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="quiet" onClick={() => setContextModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyContext} disabled={!isContextChanged}>
              Apply context
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}




