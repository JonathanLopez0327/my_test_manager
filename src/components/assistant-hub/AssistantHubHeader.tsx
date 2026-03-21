"use client";

import { useAssistantHub, getContextLabel } from "@/lib/assistant-hub";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconPlus } from "@/components/icons";
import { XMarkIcon, ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export function AssistantHubHeader() {
  const { state, actions } = useAssistantHub();
  const contextLabel = getContextLabel(state.context);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-stroke px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
          <IconSpark className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">QA Assistant</p>
        </div>
        {state.context.type !== "global" ? (
          <Badge className="ml-1 max-w-[160px] truncate px-2 py-0.5 text-[10px]">
            {contextLabel}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="xs"
          variant="quiet"
          onClick={actions.toggleHistory}
          aria-label={state.showHistory ? "Hide conversation history" : "Show conversation history"}
          className={cn(
            "h-7 w-7 rounded-full p-0",
            state.showHistory && "bg-brand-50 text-brand-700 dark:bg-brand-500/25 dark:text-brand-100",
          )}
        >
          <ClockIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="xs"
          variant="quiet"
          onClick={async () => {
            const id = await actions.createConversation();
            if (id) actions.setDraft("");
          }}
          aria-label="New conversation"
          className="h-7 w-7 rounded-full p-0"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="xs"
          variant="quiet"
          onClick={actions.close}
          aria-label="Close assistant"
          className="h-7 w-7 rounded-full p-0 text-ink-muted hover:text-ink"
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
