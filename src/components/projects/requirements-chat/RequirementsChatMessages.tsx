"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { IconClipboard } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { cn } from "@/lib/utils";
import type { RequirementsChatMessage } from "./useRequirementsChat";

type Props = {
  messages: RequirementsChatMessage[];
  isSending: boolean;
  streamingContent: string;
};

export function RequirementsChatMessages({
  messages,
  isSending,
  streamingContent,
}: Props) {
  const { data: session } = useSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const userInitials = (session?.user?.name ?? "You")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending, streamingContent]);

  if (messages.length === 0 && !isSending) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            Requirements Agent
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Generate structured requirements, user stories, or acceptance
            criteria for your project.
          </p>
        </div>
      </div>
    );
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {messages.map((message) => (
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
                <MarkdownContent
                  content={message.content}
                  className="text-ink"
                />
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            {message.role === "assistant" ? (
              <div className="flex items-center justify-end px-0.5">
                <Button
                  size="xs"
                  variant="quiet"
                  className="h-5 rounded-full border border-stroke bg-surface-elevated px-2 text-[10px] sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                  onClick={() => handleCopy(message.content)}
                  aria-label="Copy message"
                >
                  <IconClipboard className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </div>
          {message.role === "user" ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[9px] font-semibold text-white">
              {userInitials}
            </span>
          ) : null}
        </article>
      ))}

      {isSending ? (
        <article className="flex items-start gap-2 justify-start">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-semibold text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
            AI
          </span>
          <div className="max-w-[90%] space-y-1.5">
            {streamingContent ? (
              <div className="rounded-2xl border border-stroke bg-surface-muted px-3 py-2 text-[13px] leading-relaxed text-ink">
                <MarkdownContent
                  content={streamingContent}
                  className="text-ink"
                />
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[11px] font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Generating requirements...
              </div>
            )}
          </div>
        </article>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
