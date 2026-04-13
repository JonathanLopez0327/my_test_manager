"use client";

import {
  IconAlert,
  IconDocument,
  IconDownload,
  IconExternalLink,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

type ThreadDocumentState =
  | {
      status: "missing";
      message: string;
    }
  | {
      status: "pending";
      message: string;
    }
  | {
      status: "ready";
      url: string;
      filename: string;
    }
  | {
      status: "error";
      message: string;
    };

type ProjectGeneratedDocumentSheetProps = {
  open: boolean;
  onClose: () => void;
  documentState: ThreadDocumentState;
  activeThreadId: string | null;
  onRetry: () => void;
};

/**
 * Right-side panel to view the generated document for the active project chat.
 * Keeps the composer area clear while preserving open/download/preview actions.
 */
export function ProjectGeneratedDocumentSheet({
  open,
  onClose,
  documentState,
  activeThreadId,
  onRetry,
}: ProjectGeneratedDocumentSheetProps) {
  return (
    <Sheet
      open={open}
      title="Generated document"
      description="View the latest generated PDF for this chat thread."
      onClose={onClose}
      width="xl"
    >
      <section className="space-y-4" data-testid="project-generated-document-sheet">
        <div className="flex items-center gap-2">
          <IconDocument className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Generated document
          </p>
        </div>

        {documentState.status === "ready" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-ink">{documentState.filename}</p>
              <div className="flex items-center gap-1.5">
                <a
                  href={documentState.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                >
                  <IconExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
                <a
                  href={documentState.url}
                  download={documentState.filename}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke-strong bg-transparent px-3 text-xs font-semibold text-ink transition-all hover:border-brand-500/55 hover:bg-brand-50/35"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>

            <iframe
              src={documentState.url}
              title={`Generated PDF ${documentState.filename}`}
              className="h-[60vh] min-h-[320px] w-full rounded-lg border border-stroke bg-white"
              loading="lazy"
            />
          </div>
        ) : documentState.status === "pending" ? (
          <div className="rounded-lg border border-stroke bg-surface-elevated p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-ink-muted">{documentState.message}</p>
              {activeThreadId ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={onRetry}
                >
                  Reintentar
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-stroke bg-surface-elevated p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
                <p className="text-xs text-ink-muted">{documentState.message}</p>
              </div>
              {activeThreadId ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={onRetry}
                >
                  Reintentar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </Sheet>
  );
}
