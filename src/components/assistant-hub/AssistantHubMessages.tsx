"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { formatTime } from "@/lib/assistant-hub/chat-helpers";
import { IconClipboard } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { cn } from "@/lib/utils";
import type { ConversationGeneratedAttachment } from "@/lib/assistant-hub";

type Props = {
  generatedAttachments: ConversationGeneratedAttachment[];
};

export function AssistantHubMessages({ generatedAttachments }: Props) {
  const { state, dispatch } = useAssistantHub();
  const { data: session } = useSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => state.conversationMessages[state.activeConversationId] ?? [],
    [state.conversationMessages, state.activeConversationId],
  );

  const userInitials = (session?.user?.name ?? "You")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, state.isSending]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      dispatch({ type: "SET_ERROR", error: "Message could not be copied." });
    }
  };

  if (messages.length === 0 && !state.isSending) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">Start a conversation</p>
          <p className="mt-1 text-xs text-ink-muted">
            Ask about test runs, bugs, suites, or test case design.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {messages.map((message, index) => {
        const isLatestAssistant =
          message.role === "assistant" &&
          !messages.slice(index + 1).some((m) => m.role === "assistant");

        return (
          <article
            key={message.id}
            className={cn(
              "flex items-start gap-2",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {message.role === "assistant" ? (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-semibold text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
                AI
              </span>
            ) : null}
            <div className="group max-w-[90%] space-y-1.5">
              <div
                className={cn(
                  "rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
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

                {message.role === "assistant" &&
                isLatestAssistant &&
                generatedAttachments.length > 0 ? (
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Generated PDF available in attachments.
                  </p>
                ) : null}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-0.5",
                  message.role === "user" ? "justify-end" : "justify-between",
                )}
              >
                <p className="text-[10px] text-ink-soft">{formatTime(message.createdAt)}</p>
                {message.role === "assistant" ? (
                  <Button
                    size="xs"
                    variant="quiet"
                    className="h-5 rounded-full border border-stroke bg-surface-elevated px-2 text-[10px] sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                    onClick={() => handleCopy(message.content)}
                    aria-label="Copy message"
                  >
                    <IconClipboard className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </div>
            {message.role === "user" ? (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[9px] font-semibold text-white">
                {userInitials}
              </span>
            ) : null}
          </article>
        );
      })}

      {state.isSending ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[11px] font-medium text-ink-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          Generating response...
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
