"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconChevronRight,
  IconChevronUp,
  IconClipboard,
  IconPlus,
  IconSearch,
  IconSpark,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { OrganizationsResponse } from "@/components/organizations/types";
import type { ProjectsResponse } from "@/components/projects/types";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  scopeLabel?: string;
  environment?: string;
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

const FALLBACK_WORKSPACE = "Software Sushi";
const ENV_OPTIONS = ["DEV", "STAGING", "PROD"];

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

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "chat-1",
    title: "Explain run #123 failures",
    createdAt: new Date().toISOString(),
    scopeLabel: "All projects",
    environment: "DEV",
  },
  {
    id: "chat-2",
    title: "Generate test cases for login",
    createdAt: new Date().toISOString(),
    scopeLabel: "All projects",
    environment: "DEV",
  },
  {
    id: "chat-3",
    title: "Create bug from failed test",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    scopeLabel: "All projects",
    environment: "DEV",
  },
  {
    id: "chat-4",
    title: "Analyze flaky checkout suite",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    scopeLabel: "All projects",
    environment: "DEV",
  },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  "chat-1": [
    {
      id: "m-1",
      role: "user",
      content: "Explain run #123 failures.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "m-2",
      role: "assistant",
      content:
        "Run #123 failed due to 3 blocking tests in checkout. Primary issue appears in payment API timeout, plus one data setup failure. I recommend retrying in isolation, validating fixtures, and checking API latency in staging.",
      createdAt: new Date().toISOString(),
    },
  ],
};

const ATTACHMENT_HELPERS = [
  { id: "attachment-summarize", label: "Summarize", prefix: "Summarize the attached evidence" },
  { id: "attachment-errors", label: "Extract errors", prefix: "Extract errors from the attached evidence" },
  { id: "attachment-next-steps", label: "Next steps", prefix: "Suggest next steps based on the attached evidence" },
] as const;

function buildAssistantReply(prompt: string) {
  const safePrompt = prompt.trim();
  return `I can help with that. Based on your request: "${safePrompt}", here is a QA-oriented response with likely causes, impact, and next actions.`;
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
      const createdAt = new Date(conversation.createdAt);
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

/**
 * QA Assistant workspace with chat thread, context controls and QA-focused history.
 * UI-first implementation with optional backend hydration and safe fallbacks.
 */
export function AiChatWorkspace() {
  const { data: session } = useSession();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const workspaceSelectRef = useRef<HTMLSelectElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [selectedChatId, setSelectedChatId] = useState<string>(INITIAL_CONVERSATIONS[0]?.id ?? "");
  const [historyQuery, setHistoryQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

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

  const filteredConversations = useMemo(() => {
    const normalized = historyQuery.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(normalized));
  }, [conversations, historyQuery]);

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations],
  );

  const selectedMessages = conversationMessages[selectedChatId] ?? [];

  const selectedProjectLabel =
    projectOptions.find((project) => project.id === assistantContext.projectId)?.label ?? "All projects";

  const isContextChanged =
    assistantContext.workspace !== contextDraft.workspace ||
    assistantContext.projectId !== contextDraft.projectId ||
    assistantContext.environment !== contextDraft.environment;

  const handleCreateChat = () => {
    const id = `chat-${Date.now()}`;
    const now = new Date().toISOString();
    const newConversation: Conversation = {
      id,
      title: "New conversation",
      createdAt: now,
      scopeLabel: selectedProjectLabel,
      environment: assistantContext.environment,
    };
    setConversations((prev) => [newConversation, ...prev]);
    setConversationMessages((prev) => ({ ...prev, [id]: [] }));
    setSelectedChatId(id);
    setDraft("");
    setError(null);
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

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedChatId || isSending) return;

    setError(null);
    setDraft("");
    setIsSending(true);

    const now = new Date().toISOString();

    appendMessage(selectedChatId, {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: now,
    });

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedChatId
          ? {
              ...conversation,
              title: titleFromPrompt(content),
              createdAt: now,
              scopeLabel: selectedProjectLabel,
              environment: assistantContext.environment,
            }
          : conversation,
      ),
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (content.toLowerCase().includes("error")) {
        throw new Error("We could not generate a response right now.");
      }

      appendMessage(selectedChatId, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: buildAssistantReply(content),
        createdAt: new Date().toISOString(),
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "We could not generate a response right now.",
      );
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
    <section className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">QA Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">QA Assistant</h1>
        <p className="mt-1 text-sm text-ink-muted">Ask about test runs, bugs, suites and reports.</p>
      </header>

      <Card className="border border-stroke bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">CONTEXT</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Workspace: {assistantContext.workspace}
            </Badge>
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Project: {selectedProjectLabel}
            </Badge>
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Env: {assistantContext.environment}
            </Badge>
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Projects: {assistantContext.stats.projects}
            </Badge>
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Runs: {assistantContext.stats.runs}
            </Badge>
            <Badge className="h-7 cursor-default border border-stroke px-2.5 py-0 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Open Bugs: {assistantContext.stats.openBugs}
            </Badge>
            <Button size="xs" variant="secondary" onClick={() => setContextModalOpen(true)}>
              Change context
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid min-h-[calc(100vh-17rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex min-h-[620px] flex-col bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-stroke pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <IconSpark className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">QA Assistant</p>
                <p className="text-xs text-ink-soft">Grounded on workspace data</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto pr-1">
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
              selectedMessages.map((message) => (
                <article
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className="group max-w-[88%] space-y-2.5">
                    {message.role === "assistant" ? (
                      <div className="px-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">QA Assistant</p>
                        <p className="text-[11px] text-ink-soft">Grounded on workspace data</p>
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-brand-100 text-brand-700"
                          : "border border-stroke bg-surface-muted text-ink",
                      )}
                    >
                      {message.content}
                    </div>
                    <div className="flex items-center justify-between px-1">
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
                </article>
              ))
            )}

            {isSending ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Generating response...
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSend} className="mt-4 rounded-2xl border border-stroke bg-surface-elevated p-3 sm:p-4">
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
                  className="h-7 rounded-full border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {action.label}
                </Button>
              ))}
            </div>
            <p className="mb-3 text-xs text-ink-soft">Tip: Use #runId or paste a failed test title.</p>

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
            <textarea
              id="ai-prompt"
              ref={promptRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about test runs, bugs, suites, or attach evidence..."
              rows={4}
              className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
            />

            <input
              ref={evidenceInputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Attach evidence files"
              onChange={handleEvidenceSelected}
            />

            <div className="mt-3 flex items-center justify-between">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="px-0 text-ink-muted hover:bg-transparent hover:text-ink"
                onClick={() => evidenceInputRef.current?.click()}
              >
                <IconPlus className="h-4 w-4" />
                Attach evidence
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 w-9 rounded-xl p-0"
                disabled={isSending || draft.trim().length === 0}
                aria-label="Send message"
              >
                <IconChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex min-h-[620px] flex-col bg-surface p-4">
          <Button type="button" className="w-full" onClick={handleCreateChat}>
            <IconPlus className="h-4 w-4" />
            New conversation
          </Button>

          <div className="mt-4">
            <Input
              type="search"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search conversations..."
              leadingIcon={<IconSearch className="h-4 w-4" />}
              aria-label="Search conversation history"
            />
          </div>

          <div className="mt-5 flex-1 space-y-5 overflow-y-auto">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Quick actions</p>
              <div className="space-y-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={`quick-${action.id}`}
                    type="button"
                    onClick={() => insertTemplateIntoDraft(action.template)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                    <span className="flex-1 truncate">{action.label}</span>
                    <IconChevronRight className="h-3.5 w-3.5 text-ink-soft" />
                  </button>
                ))}
              </div>
            </section>

            <div className="border-t border-stroke pt-4" />

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Today</p>
              <div className="space-y-2">
                {groupedConversations.today.map((conversation) => {
                  const scopeLabel = conversation.scopeLabel ?? "All projects";
                  const environment = conversation.environment ?? "DEV";
                  const relativeTime = formatRelativeTime(conversation.createdAt);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      data-testid={`conversation-row-${conversation.id}`}
                      onClick={() => setSelectedChatId(conversation.id)}
                      className={cn(
                        "w-full rounded-lg border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        selectedChatId === conversation.id
                          ? "border-brand-400 bg-brand-50/60"
                          : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                      title={conversation.title}
                    >
                      <span className="block truncate text-sm text-ink">{conversation.title}</span>
                      <span
                        data-testid={`conversation-meta-${conversation.id}`}
                        className="mt-0.5 block truncate text-xs text-ink-soft"
                      >
                        {environment} · {scopeLabel} · {relativeTime}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Yesterday</p>
              <div className="space-y-2">
                {groupedConversations.yesterday.map((conversation) => {
                  const scopeLabel = conversation.scopeLabel ?? "All projects";
                  const environment = conversation.environment ?? "DEV";
                  const relativeTime = formatRelativeTime(conversation.createdAt);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      data-testid={`conversation-row-${conversation.id}`}
                      onClick={() => setSelectedChatId(conversation.id)}
                      className={cn(
                        "w-full rounded-lg border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        selectedChatId === conversation.id
                          ? "border-brand-400 bg-brand-50/60"
                          : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                      title={conversation.title}
                    >
                      <span className="block truncate text-sm text-ink">{conversation.title}</span>
                      <span
                        data-testid={`conversation-meta-${conversation.id}`}
                        className="mt-0.5 block truncate text-xs text-ink-soft"
                      >
                        {environment} · {scopeLabel} · {relativeTime}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {filteredConversations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stroke px-3 py-4 text-sm text-ink-muted">
                No QA conversations match this search yet.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Modal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        title="Change assistant context"
        description="Select workspace scope and environment for QA analysis."
        size="md"
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
