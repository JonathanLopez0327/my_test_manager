"use client";

import { useMemo } from "react";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { formatRelativeTime } from "@/lib/assistant-hub/chat-helpers";
import { useT } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import type { RequirementsConversation } from "./useRequirementsChat";

type Props = {
  conversations: RequirementsConversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversationId: string) => void;
};

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function RequirementsChatHistoryList({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
}: Props) {
  const t = useT();

  const { today, earlier } = useMemo(() => {
    const now = new Date();
    return conversations.reduce(
      (acc, conversation) => {
        const when = new Date(conversation.lastMessageAt);
        if (!Number.isNaN(when.getTime()) && isSameLocalDate(when, now)) {
          acc.today.push(conversation);
        } else {
          acc.earlier.push(conversation);
        }
        return acc;
      },
      { today: [] as RequirementsConversation[], earlier: [] as RequirementsConversation[] },
    );
  }, [conversations]);

  const renderSection = (label: string, items: RequirementsConversation[]) => {
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
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                activeConversationId === conversation.id
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <ChatBubbleLeftIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">
                  {conversation.title}
                </span>
                <span className="block text-[10px] opacity-60">
                  {formatRelativeTime(conversation.lastMessageAt)}
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
      {isLoading ? (
        <p className="py-4 text-center text-[11px] text-ink-soft">
          {t.requirementsChat.loadingHistory}
        </p>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-center">
          <ChatBubbleLeftIcon className="h-5 w-5 text-ink-soft" />
          <p className="text-[12px] font-medium text-ink-muted">
            {t.requirementsChat.noConversationsYet}
          </p>
          <p className="text-[11px] text-ink-soft">
            {t.requirementsChat.startNewChatHint}
          </p>
        </div>
      ) : (
        <>
          {renderSection(t.requirementsChat.today, today)}
          {renderSection(t.requirementsChat.earlier, earlier)}
        </>
      )}
    </div>
  );
}
