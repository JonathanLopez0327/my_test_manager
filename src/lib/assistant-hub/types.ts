import type { AiConversationMessageDto } from "@/components/ai-chat/types";

/* ------------------------------------------------------------------ */
/*  Screen data (what is currently visible on the page)                */
/* ------------------------------------------------------------------ */

export type ScreenDataItem = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
};

export type ScreenData = {
  viewType?: string;
  visibleItems?: ScreenDataItem[];
  filters?: Record<string, string>;
  summary?: Record<string, string | number>;
  breadcrumb?: string[];
};

/* ------------------------------------------------------------------ */
/*  Entity context                                                     */
/* ------------------------------------------------------------------ */

export type AssistantEntityContext =
  | { type: "global" }
  | { type: "project"; projectId: string; projectName: string; screenData?: ScreenData }
  | { type: "testRun"; testRunId: string; testRunTitle: string; projectId: string; screenData?: ScreenData }
  | { type: "testSuite"; testSuiteId: string; testSuiteName: string; projectId: string; screenData?: ScreenData }
  | { type: "testCase"; testCaseId: string; testCaseTitle: string; projectId: string; screenData?: ScreenData }
  | { type: "bug"; bugId: string; bugTitle: string; projectId: string; screenData?: ScreenData };

/* ------------------------------------------------------------------ */
/*  Chat types                                                         */
/* ------------------------------------------------------------------ */

export type MessageRole = "user" | "assistant";

export type AssistantMessageMetadata = {
  type?: string;
  sources?: string[];
  suggestions?: string[];
  [key: string]: unknown;
};

export type AssistantDocumentVersion = {
  version?: number;
  url: string;
  generatedAt?: string;
  testCaseCount?: number;
  changeSummary?: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  metadata?: AssistantMessageMetadata | null;
  documentVersions?: AssistantDocumentVersion[];
  threadId?: string | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  scopeLabel?: string;
  environment?: string;
  threadId?: string | null;
};

export type QuickAction = {
  id: string;
  label: string;
  template: string;
};

export type AttachmentItem = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export type ThreadDocumentApiResponse =
  | { status: "missing" }
  | { status: "pending" }
  | { status: "ready"; url: string; filename: string };

export type ThreadDocumentState =
  | { status: "missing" }
  | { status: "pending" }
  | { status: "ready"; url: string; filename: string }
  | { status: "timeout"; message: string }
  | { status: "error"; message: string };

export type ConversationGeneratedAttachment = {
  id: string;
  filename: string;
  url: string;
  source: "thread" | "message";
  createdAt?: string;
};

/* ------------------------------------------------------------------ */
/*  Hub state                                                          */
/* ------------------------------------------------------------------ */

export type AssistantHubState = {
  isOpen: boolean;
  context: AssistantEntityContext;
  activeConversationId: string;
  conversations: Conversation[];
  conversationMessages: Record<string, ChatMessage[]>;
  draft: string;
  isSending: boolean;
  error: string | null;
  showHistory: boolean;
  attachments: AttachmentItem[];
  threadDocuments: Record<string, ThreadDocumentState>;
  attachmentsPanelOpen: boolean;
  expandedAttachmentId: string | null;
};

export type AssistantHubActions = {
  open: (context?: AssistantEntityContext) => void;
  close: () => void;
  toggle: (context?: AssistantEntityContext) => void;
  setContext: (context: AssistantEntityContext) => void;
  selectConversation: (id: string) => void;
  createConversation: () => Promise<string | null>;
  sendMessage: (message: string) => Promise<void>;
  setDraft: (draft: string) => void;
  toggleHistory: () => void;
  setScreenData: (screenData: ScreenData | undefined) => void;
};

/* ------------------------------------------------------------------ */
/*  Re-export the DTO type for convenience                             */
/* ------------------------------------------------------------------ */

export type { AiConversationMessageDto };
