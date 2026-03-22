"use client";

import { useMemo } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { groupConversationsByDate, formatRelativeTime } from "@/lib/assistant-hub/chat-helpers";
import { cn } from "@/lib/utils";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";

export function AssistantHubConversationList() {
  const { state, actions } = useAssistantHub();

  const grouped = useMemo(
    () => groupConversationsByDate(state.conversations),
    [state.conversations],
  );

  if (!state.showHistory) return null;

  const renderSection = (label: string, items: typeof state.conversations) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {label}
        </p>
        <div className="space-y-1">
          {items.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                actions.selectConversation(conversation.id);
                actions.toggleHistory();
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                state.activeConversationId === conversation.id
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <ChatBubbleLeftIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{conversation.title}</span>
                <span className="block text-[10px] opacity-60">
                  {formatRelativeTime(conversation.lastMessageAt)}
                  {conversation.environment ? ` · ${conversation.environment}` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-h-56 shrink-0 space-y-3 overflow-y-auto border-b border-stroke bg-surface-muted/30 px-3 py-2.5">
      {grouped.today.length === 0 && grouped.yesterday.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-center">
          <ChatBubbleLeftIcon className="h-5 w-5 text-ink-soft" />
          <p className="text-[12px] font-medium text-ink-muted">No conversations yet</p>
          <p className="text-[11px] text-ink-soft">Start a new chat to begin.</p>
        </div>
      ) : (
        <>
          {renderSection("Today", grouped.today)}
          {renderSection("Earlier", grouped.yesterday)}
        </>
      )}
    </div>
  );
}
