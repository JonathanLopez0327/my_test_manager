import type {
  AssistantMessageMetadata,
  AssistantDocumentVersion,
  ChatMessage,
  Conversation,
  QuickAction,
} from "./types";
import type { AiConversationDto, AiConversationMessageDto } from "@/components/ai-chat/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const DOCUMENT_POLL_INTERVAL_MS = 2500;
export const DOCUMENT_POLL_MAX_ATTEMPTS = 12;
export const ENV_OPTIONS = ["DEV", "STAGING", "PROD"] as const;

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
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

export const CONTEXT_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  project: [
    { id: "gen-test-plan", label: "Generate test plan", template: "Generate a test plan for this project." },
    { id: "analyze-coverage", label: "Analyze coverage", template: "Analyze test coverage for this project." },
    { id: "suggest-cases", label: "Suggest test cases", template: "Suggest test cases for this project." },
  ],
  testRun: [
    { id: "analyze-failures", label: "Analyze failures", template: "Analyze failures in this test run." },
    { id: "gen-report", label: "Generate report", template: "Generate a summary report for this test run." },
    { id: "compare-prev", label: "Compare with previous", template: "Compare this test run with the previous one." },
  ],
  bug: [
    { id: "repro-steps", label: "Suggest repro steps", template: "Suggest reproduction steps for this bug." },
    { id: "find-related", label: "Find related tests", template: "Find test cases related to this bug." },
    { id: "draft-fix", label: "Draft fix description", template: "Draft a fix description for this bug." },
  ],
  testSuite: [
    { id: "review-coverage", label: "Review coverage", template: "Review test coverage for this suite." },
    { id: "suggest-missing", label: "Suggest missing cases", template: "Suggest missing test cases for this suite." },
    { id: "optimize-structure", label: "Optimize structure", template: "Suggest how to optimize this suite structure." },
  ],
  testCase: [
    { id: "improve-steps", label: "Improve steps", template: "Suggest improvements for this test case steps." },
    { id: "edge-cases", label: "Find edge cases", template: "Identify edge cases missing from this test case." },
    { id: "automate", label: "Automation hints", template: "Suggest how to automate this test case." },
  ],
};

export const ATTACHMENT_HELPERS = [
  { id: "attachment-summarize", label: "Summarize", prefix: "Summarize the attached evidence" },
  { id: "attachment-errors", label: "Extract errors", prefix: "Extract errors from the attached evidence" },
  { id: "attachment-next-steps", label: "Next steps", prefix: "Suggest next steps based on the attached evidence" },
] as const;

/* ------------------------------------------------------------------ */
/*  SSE streaming helpers                                              */
/* ------------------------------------------------------------------ */

export function extractAssistantDelta(payload: unknown): string {
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

export function getOverlapSize(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) return size;
  }
  return 0;
}

export function mergeAssistantChunk(current: string, incoming: string): string {
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

/* ------------------------------------------------------------------ */
/*  Payload parsing                                                    */
/* ------------------------------------------------------------------ */

export function tryParseAssistantPayload(
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
          const v = item as Record<string, unknown>;
          if (typeof v.url !== "string" || !v.url.trim()) return acc;
          acc.push({
            version: typeof v.version === "number" ? v.version : undefined,
            url: v.url,
            generatedAt: typeof v.generated_at === "string" ? v.generated_at : undefined,
            testCaseCount: typeof v.test_case_count === "number" ? v.test_case_count : undefined,
            changeSummary: typeof v.change_summary === "string" ? v.change_summary : undefined,
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

export function normalizeAssistantContent(raw: string): string {
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

export function normalizeAssistantMetadata(raw: string): AssistantMessageMetadata | null {
  const content = raw.trim();
  if (!content) return null;
  const parsed = tryParseAssistantPayload(content);
  return parsed?.metadata ?? null;
}

export function normalizeAssistantDocumentVersions(raw: string): AssistantDocumentVersion[] {
  const content = raw.trim();
  if (!content) return [];
  const parsed = tryParseAssistantPayload(content);
  return parsed?.documentVersions ?? [];
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

export function titleFromPrompt(prompt: string): string {
  return prompt.trim().slice(0, 56) || "New conversation";
}

export function formatTime(timestamp: string): string {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(timestamp: string): string {
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

export function formatDocumentGeneratedAt(timestamp?: string): string | null {
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

export function insertTemplate(currentDraft: string, template: string): string {
  const incoming = template.trim();
  if (!incoming) return currentDraft;
  const base = currentDraft.trimEnd();
  if (!base) return incoming;
  return `${base}\n${incoming}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  DTO mapping                                                        */
/* ------------------------------------------------------------------ */

export function mapMessageDto(
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

export function mapConversationDto(
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

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function groupConversationsByDate(conversations: Conversation[]): {
  today: Conversation[];
  yesterday: Conversation[];
} {
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
      } else {
        acc.yesterday.push(conversation);
      }
      return acc;
    },
    { today: [] as Conversation[], yesterday: [] as Conversation[] },
  );
}

/* ------------------------------------------------------------------ */
/*  Context helpers                                                    */
/* ------------------------------------------------------------------ */

export function getProjectIdFromContext(context: import("./types").AssistantEntityContext): string | null {
  if (context.type === "global") return null;
  return context.type === "project" ? context.projectId : context.projectId;
}

export function getContextLabel(context: import("./types").AssistantEntityContext): string {
  switch (context.type) {
    case "global":
      return "Global";
    case "project":
      return `Project: ${context.projectName}`;
    case "testRun":
      return `Test Run: ${context.testRunTitle}`;
    case "testSuite":
      return `Suite: ${context.testSuiteName}`;
    case "testCase":
      return `Test Case: ${context.testCaseTitle}`;
    case "bug":
      return `Bug: ${context.bugTitle}`;
  }
}

export function getQuickActionsForContext(context: import("./types").AssistantEntityContext): QuickAction[] {
  if (context.type === "global") return DEFAULT_QUICK_ACTIONS;
  return CONTEXT_QUICK_ACTIONS[context.type] ?? DEFAULT_QUICK_ACTIONS;
}
