"use client";

import { useAssistantHub, getContextLabel } from "@/lib/assistant-hub";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconPlus } from "@/components/icons";
import {
  XMarkIcon,
  ClockIcon,
  ChevronDownIcon,
  MinusIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export function AssistantHubHeader() {
  const { state, actions } = useAssistantHub();
  const contextLabel = getContextLabel(state.context);

  return (
    <header className="shrink-0 border-b border-stroke">
      {/* Top row: title + window controls */}
      <div className="flex h-11 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconSpark className="h-3 w-3" />
          </span>
          <p className="truncate text-[13px] font-semibold text-ink">QA Assistant</p>
          {state.context.type !== "global" ? (
            <Badge className="max-w-[140px] truncate px-1.5 py-0 text-[9px]">
              {contextLabel}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={actions.close}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Minimize assistant"
            title="Minimize"
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={actions.close}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger-500/10 hover:text-danger-600"
            aria-label="Close assistant"
            title="Close"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Action bar: new chat + history toggle */}
      <div className="flex items-center gap-1.5 border-t border-stroke/50 px-3 py-1.5">
        <button
          type="button"
          onClick={async () => {
            const id = await actions.createConversation();
            if (id) actions.setDraft("");
          }}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink"
        >
          <IconPlus className="h-3 w-3" />
          New chat
        </button>

        <button
          type="button"
          onClick={actions.toggleHistory}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
            state.showHistory
              ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
              : "border-stroke bg-surface text-ink-muted hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink",
          )}
        >
          <ClockIcon className="h-3 w-3" />
          History
          <ChevronDownIcon
            className={cn(
              "h-2.5 w-2.5 transition-transform",
              state.showHistory && "rotate-180",
            )}
          />
        </button>
      </div>
    </header>
  );
}
