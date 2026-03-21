"use client";

import { useMemo } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { groupConversationsByDate, formatRelativeTime } from "@/lib/assistant-hub/chat-helpers";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

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
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {label}
        </p>
        <div className="space-y-0.5">
          {items.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                actions.selectConversation(conversation.id);
                actions.toggleHistory();
              }}
              className={cn(
                "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                state.activeConversationId === conversation.id
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <span className="block truncate text-[12px] font-medium">{conversation.title}</span>
              <span className="block truncate text-[10px] opacity-70">
                {formatRelativeTime(conversation.lastMessageAt)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-h-48 shrink-0 space-y-2 overflow-y-auto border-b border-stroke px-3 py-2">
      {renderSection("Today", grouped.today)}
      {renderSection("Earlier", grouped.yesterday)}

      {state.conversations.length === 0 ? (
        <p className="text-[11px] text-ink-muted">No conversations yet.</p>
      ) : null}

      <Button
        type="button"
        size="xs"
        variant="quiet"
        className="w-full justify-center gap-1 text-[11px]"
        onClick={async () => {
          const id = await actions.createConversation();
          if (id) actions.toggleHistory();
        }}
      >
        <IconPlus className="h-3 w-3" />
        New conversation
      </Button>
    </div>
  );
}
