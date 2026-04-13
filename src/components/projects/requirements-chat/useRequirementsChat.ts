"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  extractAssistantDelta,
  mergeAssistantChunk,
} from "@/lib/assistant-hub/chat-helpers";

export type RequirementsChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type State = {
  messages: RequirementsChatMessage[];
  threadId: string | null;
  isSending: boolean;
  error: string | null;
  draft: string;
  streamingContent: string;
};

type Action =
  | { type: "SET_DRAFT"; draft: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SEND_START"; message: RequirementsChatMessage }
  | { type: "STREAM_CHUNK"; content: string }
  | { type: "STREAM_COMPLETE"; message: RequirementsChatMessage }
  | { type: "SET_THREAD_ID"; threadId: string };

const initialState: State = {
  messages: [],
  threadId: null,
  isSending: false,
  error: null,
  draft: "",
  streamingContent: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SEND_START":
      return {
        ...state,
        messages: [...state.messages, action.message],
        draft: "",
        isSending: true,
        error: null,
        streamingContent: "",
      };
    case "STREAM_CHUNK":
      return { ...state, streamingContent: action.content };
    case "STREAM_COMPLETE":
      return {
        ...state,
        messages: [...state.messages, action.message],
        isSending: false,
        streamingContent: "",
      };
    case "SET_THREAD_ID":
      return { ...state, threadId: action.threadId };
    default:
      return state;
  }
}

export function useRequirementsChat(projectId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || stateRef.current.isSending) return;

      const userMessage: RequirementsChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: "SEND_START", message: userMessage });

      try {
        const response = await fetch("/api/ai/requirements/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            projectId,
            ...(stateRef.current.threadId
              ? { threadId: stateRef.current.threadId }
              : {}),
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            payload?.message || "Could not generate a response.",
          );
        }

        if (!response.body) throw new Error("Response stream is empty.");

        const activeThreadId =
          response.headers.get("X-Thread-Id")?.trim() || null;
        if (activeThreadId && !stateRef.current.threadId) {
          dispatch({ type: "SET_THREAD_ID", threadId: activeThreadId });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let assistantContent = "";

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
              assistantContent = mergeAssistantChunk(
                assistantContent,
                delta,
              );
              dispatch({ type: "STREAM_CHUNK", content: assistantContent });
            } catch {
              continue;
            }
          }
        }

        const finalContent =
          assistantContent.trim() ||
          "No response was returned for this request.";

        dispatch({
          type: "STREAM_COMPLETE",
          message: {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: finalContent,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Could not generate a response.";
        dispatch({ type: "SET_ERROR", error: errorMessage });
        dispatch({
          type: "STREAM_COMPLETE",
          message: {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Error communicating with the requirements agent.",
            createdAt: new Date().toISOString(),
          },
        });
      }
    },
    [projectId],
  );

  const setDraft = useCallback((draft: string) => {
    dispatch({ type: "SET_DRAFT", draft });
  }, []);

  return { state, sendMessage, setDraft };
}
