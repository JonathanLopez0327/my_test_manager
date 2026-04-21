"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  extractAssistantDelta,
  mergeAssistantChunk,
} from "@/lib/assistant-hub/chat-helpers";
import { normalizeRequirementsContent } from "@/lib/ai/requirements-content";
import { useT } from "@/lib/i18n/LocaleProvider";

export type RequirementsChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type RequirementsConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  threadId: string | null;
  messages: RequirementsChatMessage[];
};

type ConversationDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  threadId: string | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
};

type State = {
  conversations: RequirementsConversation[];
  activeConversationId: string | null;
  isSending: boolean;
  isLoadingConversations: boolean;
  isCreatingConversation: boolean;
  error: string | null;
  draft: string;
  streamingContent: string;
  showHistory: boolean;
};

type Action =
  | { type: "SET_DRAFT"; draft: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "LOAD_CONVERSATIONS_START" }
  | { type: "LOAD_CONVERSATIONS_SUCCESS"; conversations: RequirementsConversation[] }
  | { type: "LOAD_CONVERSATIONS_ERROR"; error: string }
  | { type: "CREATE_CONVERSATION_START" }
  | { type: "CREATE_CONVERSATION_SUCCESS"; conversation: RequirementsConversation }
  | { type: "CREATE_CONVERSATION_ERROR"; error: string }
  | { type: "SELECT_CONVERSATION"; conversationId: string }
  | { type: "TOGGLE_HISTORY" }
  | { type: "SEND_START"; conversationId: string; message: RequirementsChatMessage }
  | { type: "STREAM_CHUNK"; content: string }
  | { type: "STREAM_COMPLETE"; conversationId: string; message: RequirementsChatMessage; newTitle?: string }
  | { type: "UPDATE_CONVERSATION_THREAD"; conversationId: string; threadId: string };

const initialState: State = {
  conversations: [],
  activeConversationId: null,
  isSending: false,
  isLoadingConversations: false,
  isCreatingConversation: false,
  error: null,
  draft: "",
  streamingContent: "",
  showHistory: false,
};

function reorderActiveFirst(
  conversations: RequirementsConversation[],
  activeId: string,
): RequirementsConversation[] {
  const active = conversations.find((c) => c.id === activeId);
  if (!active) return conversations;
  return [active, ...conversations.filter((c) => c.id !== activeId)];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "LOAD_CONVERSATIONS_START":
      return { ...state, isLoadingConversations: true, error: null };
    case "LOAD_CONVERSATIONS_SUCCESS":
      return {
        ...state,
        isLoadingConversations: false,
        conversations: action.conversations,
        activeConversationId:
          action.conversations[0]?.id ?? null,
      };
    case "LOAD_CONVERSATIONS_ERROR":
      return { ...state, isLoadingConversations: false, error: action.error };
    case "CREATE_CONVERSATION_START":
      return { ...state, isCreatingConversation: true, error: null };
    case "CREATE_CONVERSATION_SUCCESS":
      return {
        ...state,
        isCreatingConversation: false,
        conversations: [action.conversation, ...state.conversations],
        activeConversationId: action.conversation.id,
        draft: "",
        streamingContent: "",
      };
    case "CREATE_CONVERSATION_ERROR":
      return { ...state, isCreatingConversation: false, error: action.error };
    case "SELECT_CONVERSATION":
      return {
        ...state,
        activeConversationId: action.conversationId,
        streamingContent: "",
        error: null,
      };
    case "TOGGLE_HISTORY":
      return { ...state, showHistory: !state.showHistory };
    case "SEND_START":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? {
                ...c,
                messages: [...c.messages, action.message],
                lastMessageAt: action.message.createdAt,
              }
            : c,
        ),
        draft: "",
        isSending: true,
        error: null,
        streamingContent: "",
      };
    case "STREAM_CHUNK":
      return { ...state, streamingContent: action.content };
    case "STREAM_COMPLETE": {
      const updated = state.conversations.map((c) =>
        c.id === action.conversationId
          ? {
              ...c,
              messages: [...c.messages, action.message],
              lastMessageAt: action.message.createdAt,
              title:
                action.newTitle && c.title === "New conversation"
                  ? action.newTitle
                  : c.title,
            }
          : c,
      );
      return {
        ...state,
        conversations: reorderActiveFirst(updated, action.conversationId),
        isSending: false,
        streamingContent: "",
      };
    }
    case "UPDATE_CONVERSATION_THREAD":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, threadId: action.threadId } : c,
        ),
      };
    default:
      return state;
  }
}

function toConversation(dto: ConversationDto): RequirementsConversation {
  return {
    id: dto.id,
    title: dto.title,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    lastMessageAt: dto.lastMessageAt,
    threadId: dto.threadId,
    messages: dto.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content:
        m.role === "assistant" ? normalizeRequirementsContent(m.content) : m.content,
      createdAt: m.createdAt,
    })),
  };
}

function deriveTitleFromPrompt(prompt: string): string {
  return prompt.trim().slice(0, 56) || "New conversation";
}

export function useRequirementsChat(projectId: string) {
  const t = useT();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const messagesRef = useRef(t.requirementsChat);
  messagesRef.current = t.requirementsChat;

  useEffect(() => {
    const messages = messagesRef.current;
    let cancelled = false;
    dispatch({ type: "LOAD_CONVERSATIONS_START" });
    (async () => {
      try {
        const res = await fetch(
          `/api/ai/requirements/conversations?projectId=${encodeURIComponent(projectId)}`,
          { method: "GET" },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message || messages.couldNotLoadHistory);
        }
        const body = (await res.json()) as { items: ConversationDto[] };
        if (cancelled) return;
        dispatch({
          type: "LOAD_CONVERSATIONS_SUCCESS",
          conversations: body.items.map(toConversation),
        });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "LOAD_CONVERSATIONS_ERROR",
          error: err instanceof Error ? err.message : messages.couldNotLoadHistory,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const createConversation = useCallback(async (): Promise<string | null> => {
    const messages = messagesRef.current;
    if (stateRef.current.isCreatingConversation) return null;
    dispatch({ type: "CREATE_CONVERSATION_START" });
    try {
      const res = await fetch("/api/ai/requirements/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message || messages.couldNotCreateConversation);
      }
      const body = (await res.json()) as { item: ConversationDto };
      const conversation = toConversation(body.item);
      dispatch({ type: "CREATE_CONVERSATION_SUCCESS", conversation });
      return conversation.id;
    } catch (err) {
      dispatch({
        type: "CREATE_CONVERSATION_ERROR",
        error:
          err instanceof Error ? err.message : messages.couldNotCreateConversation,
      });
      return null;
    }
  }, [projectId]);

  const selectConversation = useCallback((conversationId: string) => {
    dispatch({ type: "SELECT_CONVERSATION", conversationId });
  }, []);

  const toggleHistory = useCallback(() => {
    dispatch({ type: "TOGGLE_HISTORY" });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || stateRef.current.isSending) return;
      const messages = messagesRef.current;

      let conversationId = stateRef.current.activeConversationId;
      if (!conversationId) {
        conversationId = await createConversation();
        if (!conversationId) return;
      }

      const userMessage: RequirementsChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: "SEND_START", conversationId, message: userMessage });

      try {
        const response = await fetch("/api/ai/requirements/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            projectId,
            conversationId,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message || messages.errorGenericResponse);
        }

        if (!response.body) throw new Error(messages.streamEmpty);

        const headerThreadId = response.headers.get("X-Thread-Id")?.trim() || null;
        if (headerThreadId) {
          dispatch({
            type: "UPDATE_CONVERSATION_THREAD",
            conversationId,
            threadId: headerThreadId,
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
              const normalized = normalizeRequirementsContent(assistantRawContent);
              dispatch({ type: "STREAM_CHUNK", content: normalized });
            } catch {
              continue;
            }
          }
        }

        const finalContent =
          normalizeRequirementsContent(assistantRawContent).trim() ||
          messages.emptyResponse;

        dispatch({
          type: "STREAM_COMPLETE",
          conversationId,
          message: {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: finalContent,
            createdAt: new Date().toISOString(),
          },
          newTitle: deriveTitleFromPrompt(trimmed),
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : messages.errorGenericResponse;
        dispatch({ type: "SET_ERROR", error: errorMessage });
        dispatch({
          type: "STREAM_COMPLETE",
          conversationId,
          message: {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: messages.errorFallback,
            createdAt: new Date().toISOString(),
          },
        });
      }
    },
    [projectId, createConversation],
  );

  const setDraft = useCallback((draft: string) => {
    dispatch({ type: "SET_DRAFT", draft });
  }, []);

  const activeConversation =
    state.conversations.find((c) => c.id === state.activeConversationId) ?? null;

  return {
    state,
    activeConversation,
    sendMessage,
    setDraft,
    createConversation,
    selectConversation,
    toggleHistory,
  };
}
