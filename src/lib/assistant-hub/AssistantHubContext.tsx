"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  AssistantEntityContext,
  AssistantHubState,
  AssistantHubActions,
  ChatMessage,
  Conversation,
  ThreadDocumentState,
  AttachmentItem,
} from "./types";
import type { AiConversationDto, AiConversationsResponse } from "@/components/ai-chat/types";
import {
  extractAssistantDelta,
  mergeAssistantChunk,
  normalizeAssistantContent,
  normalizeAssistantMetadata,
  normalizeAssistantDocumentVersions,
  titleFromPrompt,
  mapMessageDto,
  mapConversationDto,
  sleep,
  getProjectIdFromContext,
  DOCUMENT_POLL_INTERVAL_MS,
  DOCUMENT_POLL_MAX_ATTEMPTS,
} from "./chat-helpers";
import type { ThreadDocumentApiResponse } from "./types";

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type Action =
  | { type: "OPEN"; context?: AssistantEntityContext }
  | { type: "CLOSE" }
  | { type: "SET_CONTEXT"; context: AssistantEntityContext }
  | { type: "SET_CONVERSATIONS"; conversations: Conversation[] }
  | { type: "SET_MESSAGES"; conversationId: string; messages: ChatMessage[] }
  | { type: "APPEND_MESSAGE"; conversationId: string; message: ChatMessage }
  | { type: "SELECT_CONVERSATION"; id: string }
  | { type: "SET_DRAFT"; draft: string }
  | { type: "SET_SENDING"; isSending: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "TOGGLE_HISTORY" }
  | { type: "SET_THREAD_DOCUMENT"; threadId: string; state: ThreadDocumentState }
  | { type: "SET_ATTACHMENTS"; attachments: AttachmentItem[] }
  | { type: "SET_ATTACHMENTS_PANEL_OPEN"; open: boolean }
  | { type: "SET_EXPANDED_ATTACHMENT"; id: string | null }
  | { type: "UPDATE_CONVERSATIONS"; updater: (prev: Conversation[]) => Conversation[] };

const initialState: AssistantHubState = {
  isOpen: false,
  context: { type: "global" },
  activeConversationId: "",
  conversations: [],
  conversationMessages: {},
  draft: "",
  isSending: false,
  error: null,
  showHistory: false,
  attachments: [],
  threadDocuments: {},
  attachmentsPanelOpen: false,
  expandedAttachmentId: null,
};

function reducer(state: AssistantHubState, action: Action): AssistantHubState {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        isOpen: true,
        ...(action.context ? { context: action.context } : {}),
      };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "SET_CONTEXT":
      return { ...state, context: action.context };
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.conversations };
    case "SET_MESSAGES":
      return {
        ...state,
        conversationMessages: {
          ...state.conversationMessages,
          [action.conversationId]: action.messages,
        },
      };
    case "APPEND_MESSAGE":
      return {
        ...state,
        conversationMessages: {
          ...state.conversationMessages,
          [action.conversationId]: [
            ...(state.conversationMessages[action.conversationId] ?? []),
            action.message,
          ],
        },
      };
    case "SELECT_CONVERSATION":
      return { ...state, activeConversationId: action.id };
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "SET_SENDING":
      return { ...state, isSending: action.isSending };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "TOGGLE_HISTORY":
      return { ...state, showHistory: !state.showHistory };
    case "SET_THREAD_DOCUMENT":
      return {
        ...state,
        threadDocuments: {
          ...state.threadDocuments,
          [action.threadId]: action.state,
        },
      };
    case "SET_ATTACHMENTS":
      return { ...state, attachments: action.attachments };
    case "SET_ATTACHMENTS_PANEL_OPEN":
      return { ...state, attachmentsPanelOpen: action.open };
    case "SET_EXPANDED_ATTACHMENT":
      return { ...state, expandedAttachmentId: action.id };
    case "UPDATE_CONVERSATIONS":
      return { ...state, conversations: action.updater(state.conversations) };
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

type HubContextValue = {
  state: AssistantHubState;
  actions: AssistantHubActions;
  dispatch: React.Dispatch<Action>;
};

const HubContext = createContext<HubContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function AssistantHubProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unmountedRef = useRef(false);
  const pollingThreadsRef = useRef<Set<string>>(new Set());
  const checkedThreadsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Load conversations when context changes to a project-scoped entity
  const projectId = getProjectIdFromContext(state.context);

  useEffect(() => {
    // When context is global, keep existing conversations — don't clear them
    if (!projectId) return;

    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/ai/conversations?projectId=${encodeURIComponent(projectId)}`,
        );
        if (!response.ok) throw new Error("Could not load conversations.");
        const payload = (await response.json()) as AiConversationsResponse;
        if (!active) return;

        const scopeLabel = state.context.type === "project" ? state.context.projectName : "Project";
        const conversations = payload.items.map((item) => mapConversationDto(item, scopeLabel));
        const messages: Record<string, ChatMessage[]> = {};
        for (const item of payload.items) {
          messages[item.id] = item.messages.map((m) => mapMessageDto(m, item.threadId));
        }

        dispatch({ type: "SET_CONVERSATIONS", conversations });
        dispatch({ type: "SET_ERROR", error: null });

        // Set messages for each conversation
        for (const [id, msgs] of Object.entries(messages)) {
          dispatch({ type: "SET_MESSAGES", conversationId: id, messages: msgs });
        }

        // Select first conversation if none selected
        if (!state.activeConversationId || !conversations.some((c) => c.id === state.activeConversationId)) {
          dispatch({ type: "SELECT_CONVERSATION", id: conversations[0]?.id ?? "" });
        }
      } catch {
        if (!active) return;
        dispatch({ type: "SET_ERROR", error: "Could not load conversation history." });
        dispatch({ type: "SET_CONVERSATIONS", conversations: [] });
        dispatch({ type: "SELECT_CONVERSATION", id: "" });
      }
    };

    void load();
    return () => { active = false; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check thread document when active conversation changes
  const selectedConversation = state.conversations.find((c) => c.id === state.activeConversationId);
  const selectedThreadId = selectedConversation?.threadId?.trim() || "";

  const checkThreadDocument = useCallback(async (threadId: string) => {
    if (!threadId || checkedThreadsRef.current.has(threadId)) return;
    checkedThreadsRef.current.add(threadId);

    try {
      const response = await fetch(
        `/api/ai-chat/threads/${encodeURIComponent(threadId)}/document`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        if (!unmountedRef.current) {
          dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "missing" } });
        }
        return;
      }
      const payload = (await response.json()) as ThreadDocumentApiResponse;
      if (!unmountedRef.current) {
        if (payload.status === "ready") {
          dispatch({
            type: "SET_THREAD_DOCUMENT",
            threadId,
            state: { status: "ready", url: payload.url, filename: payload.filename },
          });
        } else if (payload.status === "pending") {
          dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "pending" } });
        } else {
          dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "missing" } });
        }
      }
    } catch {
      if (!unmountedRef.current) {
        dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "missing" } });
      }
    }
  }, []);

  useEffect(() => {
    if (selectedThreadId) void checkThreadDocument(selectedThreadId);
  }, [selectedThreadId, checkThreadDocument]);

  const pollThreadDocumentUntilReady = useCallback(async (threadId: string) => {
    if (!threadId || pollingThreadsRef.current.has(threadId)) return;
    pollingThreadsRef.current.add(threadId);
    checkedThreadsRef.current.add(threadId);

    dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "pending" } });

    let sawPending = false;
    try {
      for (let attempt = 0; attempt < DOCUMENT_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (unmountedRef.current) return;
        const response = await fetch(
          `/api/ai-chat/threads/${encodeURIComponent(threadId)}/document`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const errPayload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(errPayload?.message || "Could not fetch the generated document.");
        }
        const payload = (await response.json()) as ThreadDocumentApiResponse;
        if (payload.status === "ready") {
          if (!unmountedRef.current) {
            dispatch({
              type: "SET_THREAD_DOCUMENT",
              threadId,
              state: { status: "ready", url: payload.url, filename: payload.filename },
            });
          }
          return;
        }
        if (payload.status === "missing") {
          if (!unmountedRef.current) {
            dispatch({ type: "SET_THREAD_DOCUMENT", threadId, state: { status: "missing" } });
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
        dispatch({
          type: "SET_THREAD_DOCUMENT",
          threadId,
          state: {
            status: "error",
            message: pollError instanceof Error ? pollError.message : "Could not get the generated document.",
          },
        });
      }
      return;
    } finally {
      pollingThreadsRef.current.delete(threadId);
    }

    if (!unmountedRef.current && sawPending) {
      dispatch({
        type: "SET_THREAD_DOCUMENT",
        threadId,
        state: {
          status: "timeout",
          message: "The document is not ready yet. You can retry in a few seconds.",
        },
      });
    }
  }, []);

  // Keep a ref to latest state so actions never depend on state directly
  const stateRef = useRef(state);
  stateRef.current = state;

  // Stable actions — never change identity, read state via ref
  const actions = useMemo<AssistantHubActions>(() => {
    const open = (context?: AssistantEntityContext) => {
      dispatch({ type: "OPEN", context });
    };

    const close = () => dispatch({ type: "CLOSE" });

    const toggle = (context?: AssistantEntityContext) => {
      if (stateRef.current.isOpen && !context) {
        dispatch({ type: "CLOSE" });
      } else {
        dispatch({ type: "OPEN", context });
      }
    };

    const setContext = (context: AssistantEntityContext) => {
      dispatch({ type: "SET_CONTEXT", context });
    };

    const selectConversation = (id: string) => {
      dispatch({ type: "SELECT_CONVERSATION", id });
      const conv = stateRef.current.conversations.find((c) => c.id === id);
      const tid = conv?.threadId?.trim();
      if (tid) void checkThreadDocument(tid);
    };

    const createConversation = async (): Promise<string | null> => {
      const s = stateRef.current;
      const pid = getProjectIdFromContext(s.context);
      if (!pid) {
        dispatch({ type: "SET_ERROR", error: "Select a project context before creating a conversation." });
        return null;
      }

      try {
        const response = await fetch("/api/ai/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid, environment: "DEV" }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message || "Could not create conversation.");
        }
        const payload = (await response.json()) as { item: AiConversationDto };
        const scopeLabel = s.context.type === "project" ? s.context.projectName : "Project";
        const created = mapConversationDto(payload.item, scopeLabel);
        const createdMessages = payload.item.messages.map((m) =>
          mapMessageDto(m, payload.item.threadId),
        );

        dispatch({
          type: "UPDATE_CONVERSATIONS",
          updater: (prev) =>
            [created, ...prev.filter((c) => c.id !== created.id)].slice(0, 5),
        });
        dispatch({ type: "SET_MESSAGES", conversationId: created.id, messages: createdMessages });
        dispatch({ type: "SELECT_CONVERSATION", id: created.id });
        dispatch({ type: "SET_ERROR", error: null });
        return created.id;
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Could not create conversation.",
        });
        return null;
      }
    };

    const sendMessage = async (message: string): Promise<void> => {
      const s = stateRef.current;
      const content = message.trim();
      if (!content || s.isSending) return;

      const pid = getProjectIdFromContext(s.context);

      let chatId = s.activeConversationId;
      if (!chatId) {
        // Creating a new conversation requires a project context
        if (!pid) {
          dispatch({ type: "SET_ERROR", error: "Select a project context before sending a message." });
          return;
        }
        const createdId = await createConversation();
        if (!createdId) return;
        chatId = createdId;
      }

      dispatch({ type: "SET_ERROR", error: null });
      dispatch({ type: "SET_DRAFT", draft: "" });
      dispatch({ type: "SET_SENDING", isSending: true });

      const now = new Date().toISOString();
      dispatch({
        type: "APPEND_MESSAGE",
        conversationId: chatId,
        message: { id: `u-${Date.now()}`, role: "user", content, createdAt: now },
      });

      dispatch({
        type: "UPDATE_CONVERSATIONS",
        updater: (prev) => {
          const updated = prev.map((c) =>
            c.id === chatId
              ? { ...c, title: titleFromPrompt(content), lastMessageAt: now, updatedAt: now }
              : c,
          );
          const selected = updated.find((c) => c.id === chatId);
          const others = updated.filter((c) => c.id !== chatId);
          return selected ? [selected, ...others].slice(0, 5) : updated;
        },
      });

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversationId: chatId, ...(pid ? { projectId: pid } : {}) }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message || "We could not generate a response right now.");
        }
        if (!response.body) throw new Error("The AI response stream is empty.");

        const activeThreadId = response.headers.get("X-Thread-Id")?.trim() || null;
        if (activeThreadId) {
          dispatch({
            type: "UPDATE_CONVERSATIONS",
            updater: (prev) =>
              prev.map((c) =>
                c.id === chatId ? { ...c, threadId: activeThreadId } : c,
              ),
          });
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
        const assistantContent = formattedContent || "No assistant content was returned for this request.";
        const assistantMetadata = normalizeAssistantMetadata(assistantRawContent);
        const assistantDocumentVersions = normalizeAssistantDocumentVersions(assistantRawContent);

        dispatch({
          type: "APPEND_MESSAGE",
          conversationId: chatId,
          message: {
            id: `a-${Date.now() + 1}`,
            role: "assistant",
            content: assistantContent,
            metadata: assistantMetadata,
            documentVersions: assistantDocumentVersions,
            threadId: activeThreadId,
            createdAt: new Date().toISOString(),
          },
        });

        if (activeThreadId) {
          void pollThreadDocumentUntilReady(activeThreadId);
        }
      } catch (sendError) {
        const nextError =
          sendError instanceof Error ? sendError.message : "We could not generate a response right now.";
        dispatch({ type: "SET_ERROR", error: nextError });
        dispatch({
          type: "APPEND_MESSAGE",
          conversationId: chatId,
          message: {
            id: `a-${Date.now() + 1}`,
            role: "assistant",
            content: "Error communicating with the assistant.",
            metadata: null,
            documentVersions: [],
            threadId: null,
            createdAt: new Date().toISOString(),
          },
        });
      } finally {
        dispatch({ type: "SET_SENDING", isSending: false });
      }
    };

    const setDraft = (draft: string) => dispatch({ type: "SET_DRAFT", draft });
    const toggleHistory = () => dispatch({ type: "TOGGLE_HISTORY" });

    return {
      open,
      close,
      toggle,
      setContext,
      selectConversation,
      createConversation,
      sendMessage,
      setDraft,
      toggleHistory,
    };
  }, [checkThreadDocument, pollThreadDocumentUntilReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<HubContextValue>(
    () => ({ state, actions, dispatch }),
    [state, actions],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAssistantHub(): HubContextValue {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useAssistantHub must be used within <AssistantHubProvider>");
  return ctx;
}
