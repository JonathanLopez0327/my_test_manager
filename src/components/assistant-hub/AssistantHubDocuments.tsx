"use client";

import { useMemo } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { formatDocumentGeneratedAt } from "@/lib/assistant-hub/chat-helpers";
import {
  IconChevronDown,
  IconChevronUp,
  IconDocument,
  IconDownload,
  IconExternalLink,
  IconAlert,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ConversationGeneratedAttachment } from "@/lib/assistant-hub";

type Props = {
  generatedAttachments: ConversationGeneratedAttachment[];
};

export function AssistantHubDocuments({ generatedAttachments }: Props) {
  const { state, dispatch } = useAssistantHub();

  const selectedConversation = state.conversations.find(
    (c) => c.id === state.activeConversationId,
  );
  const selectedThreadId = selectedConversation?.threadId?.trim() || "";
  const threadDocState = selectedThreadId
    ? state.threadDocuments[selectedThreadId]
    : undefined;

  const hasVisibleContent =
    generatedAttachments.length > 0 ||
    threadDocState?.status === "pending" ||
    threadDocState?.status === "timeout" ||
    threadDocState?.status === "error";

  if (!hasVisibleContent && !state.attachmentsPanelOpen) return null;

  return (
    <section className="shrink-0 border-t border-stroke bg-surface-elevated px-3 py-2">
      <div className="space-y-2 rounded-lg border border-stroke bg-surface p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <IconDocument className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Attachments
            </span>
            {generatedAttachments.length > 0 ? (
              <Badge className="px-1.5 py-0 text-[9px]">{generatedAttachments.length}</Badge>
            ) : null}
          </div>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() =>
              dispatch({ type: "SET_ATTACHMENTS_PANEL_OPEN", open: !state.attachmentsPanelOpen })
            }
            className="h-5 gap-0.5 px-1.5 text-[10px] text-ink-muted"
          >
            {state.attachmentsPanelOpen ? (
              <IconChevronUp className="h-2.5 w-2.5" />
            ) : (
              <IconChevronDown className="h-2.5 w-2.5" />
            )}
          </Button>
        </div>

        {state.attachmentsPanelOpen && threadDocState?.status === "pending" ? (
          <div className="rounded-md border border-stroke bg-surface-elevated p-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="text-[11px] text-ink-muted">Generating document...</span>
            </div>
          </div>
        ) : null}

        {state.attachmentsPanelOpen &&
        (threadDocState?.status === "timeout" || threadDocState?.status === "error") ? (
          <div className="rounded-md border border-stroke bg-surface-elevated p-2">
            <div className="flex items-start gap-1.5">
              <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-500" />
              <div className="space-y-1">
                <p className="text-[11px] text-ink-muted">{threadDocState.message}</p>
                <Button type="button" size="xs" variant="secondary" className="h-5 text-[10px]">
                  Retry
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {state.attachmentsPanelOpen && generatedAttachments.length > 0
          ? generatedAttachments.map((att) => {
              const generatedAt = formatDocumentGeneratedAt(att.createdAt);
              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-stroke bg-surface-elevated p-2"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <IconDocument className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span className="truncate text-[12px] font-medium text-ink">
                      {att.filename}
                    </span>
                    <Badge tone="info" className="px-1.5 py-0 text-[9px]">
                      PDF
                    </Badge>
                    {generatedAt ? (
                      <span className="text-[10px] text-ink-soft">{generatedAt}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-stroke px-1.5 text-[10px] font-medium text-ink hover:bg-brand-50/35"
                    >
                      <IconExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={att.url}
                      download={att.filename}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-stroke px-1.5 text-[10px] font-medium text-ink hover:bg-brand-50/35"
                    >
                      <IconDownload className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })
          : null}

        {state.attachmentsPanelOpen &&
        generatedAttachments.length === 0 &&
        (!threadDocState || threadDocState.status === "missing") ? (
          <p className="text-[11px] text-ink-muted">No documents generated yet.</p>
        ) : null}
      </div>
    </section>
  );
}
