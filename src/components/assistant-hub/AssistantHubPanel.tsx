"use client";

import { useMemo } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import type { ConversationGeneratedAttachment } from "@/lib/assistant-hub";
import { AssistantHubHeader } from "./AssistantHubHeader";
import { AssistantHubConversationList } from "./AssistantHubConversationList";
import { AssistantHubMessages } from "./AssistantHubMessages";
import { AssistantHubDocuments } from "./AssistantHubDocuments";
import { AssistantHubInput } from "./AssistantHubInput";
import { cn } from "@/lib/utils";

export function AssistantHubPanel() {
  const { state } = useAssistantHub();

  const selectedMessages = useMemo(
    () => state.conversationMessages[state.activeConversationId] ?? [],
    [state.conversationMessages, state.activeConversationId],
  );

  const selectedConversation = state.conversations.find(
    (c) => c.id === state.activeConversationId,
  );
  const selectedThreadId = selectedConversation?.threadId?.trim() || "";
  const threadDocState = selectedThreadId
    ? state.threadDocuments[selectedThreadId]
    : undefined;

  const generatedAttachments = useMemo<ConversationGeneratedAttachment[]>(() => {
    const fromMessages: ConversationGeneratedAttachment[] = [];

    for (const message of selectedMessages) {
      if (message.role !== "assistant" || (message.documentVersions?.length ?? 0) === 0)
        continue;

      message.documentVersions?.forEach((version, index) => {
        if (!version?.url?.trim()) return;
        const fallbackName = (() => {
          try {
            const pathname = new URL(version.url).pathname;
            const name = pathname.split("/").pop()?.trim();
            return name || `document-version-${index + 1}.pdf`;
          } catch {
            return `document-version-${index + 1}.pdf`;
          }
        })();

        fromMessages.push({
          id: `msg-${message.id}-${index}`,
          filename: fallbackName,
          url: version.url,
          source: "message",
          createdAt: version.generatedAt,
        });
      });
    }

    const threadAttachment =
      selectedThreadId && threadDocState?.status === "ready"
        ? ({
            id: `thread-${selectedThreadId}`,
            filename: threadDocState.filename,
            url: threadDocState.url,
            source: "thread",
          } satisfies ConversationGeneratedAttachment)
        : null;

    const seen = new Set<string>();
    const deduped: ConversationGeneratedAttachment[] = [];
    const ordered = threadAttachment ? [threadAttachment, ...fromMessages] : fromMessages;

    for (const att of ordered) {
      const key = `${att.url}::${att.filename}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(att);
    }

    return deduped;
  }, [selectedMessages, selectedThreadId, threadDocState]);

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col border-l border-stroke bg-surface-elevated",
        "transition-all duration-300 ease-[var(--ease-emphasis)]",
        state.isOpen ? "w-[420px]" : "w-0 overflow-hidden border-l-0",
      )}
    >
      {state.isOpen ? (
        <>
          <AssistantHubHeader />
          <AssistantHubConversationList />
          <AssistantHubMessages generatedAttachments={generatedAttachments} />
          <AssistantHubDocuments generatedAttachments={generatedAttachments} />
          <AssistantHubInput />
        </>
      ) : null}
    </div>
  );
}
