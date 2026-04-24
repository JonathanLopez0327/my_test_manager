"use client";

import { IconRefresh } from "../icons";
import { useT } from "@/lib/i18n/LocaleProvider";

type RefreshIconButtonProps = {
  onRefresh: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
};

const base =
  "inline-flex items-center justify-center rounded-lg border border-stroke-strong bg-surface-elevated text-ink shadow-soft-xs transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50 dark:bg-surface-muted dark:hover:bg-brand-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-60";

export function RefreshIconButton({
  onRefresh,
  loading = false,
  label,
  className = "",
}: RefreshIconButtonProps) {
  const t = useT();
  const tooltip = label ?? t.common.refresh;

  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      onClick={onRefresh}
      disabled={loading}
      className={`${base} h-9 w-9 p-0 ${className}`}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
