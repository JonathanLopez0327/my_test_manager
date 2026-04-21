"use client";

import { ChevronDownIcon, ClockIcon } from "@heroicons/react/24/outline";
import { IconPlus } from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

type Props = {
  showHistory: boolean;
  isBusy: boolean;
  onNewChat: () => void;
  onToggleHistory: () => void;
};

export function RequirementsChatToolbar({
  showHistory,
  isBusy,
  onNewChat,
  onToggleHistory,
}: Props) {
  const t = useT();

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-stroke px-3 py-1.5">
      <button
        type="button"
        onClick={onNewChat}
        disabled={isBusy}
        className="flex h-7 items-center gap-1.5 rounded-lg border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <IconPlus className="h-3 w-3" />
        {t.requirementsChat.newChat}
      </button>

      <button
        type="button"
        onClick={onToggleHistory}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
          showHistory
            ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
            : "border-stroke bg-surface text-ink-muted hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink",
        )}
      >
        <ClockIcon className="h-3 w-3" />
        {t.requirementsChat.history}
        <ChevronDownIcon
          className={cn(
            "h-2.5 w-2.5 transition-transform",
            showHistory && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}
