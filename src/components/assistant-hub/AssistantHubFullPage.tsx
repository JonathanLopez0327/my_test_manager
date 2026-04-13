"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAssistantHub } from "@/lib/assistant-hub";
import type { ConversationGeneratedAttachment } from "@/lib/assistant-hub";
import { parseAssistantContextFromParams } from "@/lib/assistant-hub/chat-helpers";
import { AssistantHubMessages } from "./AssistantHubMessages";
import { AssistantHubDocuments } from "./AssistantHubDocuments";
import { AssistantHubInput } from "./AssistantHubInput";
import { AssistantHubConversationList } from "./AssistantHubConversationList";
import { AssistantHubFullPageHeader } from "./AssistantHubFullPageHeader";

export function AssistantHubFullPage() {
  const searchParams = useSearchParams();
  const { state, actions } = useAssistantHub();
  const initializedRef = useRef(false);

  // Parse context from URL search params on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const parsed = parseAssistantContextFromParams(searchParams);
    actions.setContext(parsed);
    // Close the side panel if it was open — we're now in full-page mode
    actions.close();
  }, [searchParams, actions]);

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
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Main chat area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-elevated">
        <AssistantHubFullPageHeader />
        <AssistantHubConversationList />
        <AssistantHubMessages generatedAttachments={generatedAttachments} />
        <AssistantHubDocuments generatedAttachments={generatedAttachments} />
        <AssistantHubInput />
      </div>
    </div>
  );
}
