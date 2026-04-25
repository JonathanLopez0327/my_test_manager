import type { ReactNode } from "react";

type CalloutTone = "info" | "warning" | "success";

const toneStyles: Record<CalloutTone, string> = {
  info: "border-brand-300/40 bg-brand-50/60 dark:bg-brand-500/8",
  warning: "border-warning-500/30 bg-warning-50/80 dark:bg-warning-500/10",
  success: "border-success-500/30 bg-success-50/80 dark:bg-success-500/10",
};

const toneLabel: Record<CalloutTone, string> = {
  info: "Note",
  warning: "Heads up",
  success: "Tip",
};

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={`my-6 rounded-2xl border px-5 py-4 ${toneStyles[tone]}`}
      role="note"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {title ?? toneLabel[tone]}
      </p>
      <div className="mt-1.5 text-sm leading-7 text-ink">{children}</div>
    </aside>
  );
}
