import type { HTMLAttributes } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-500/10 text-success-500",
  warning: "bg-warning-500/10 text-warning-500",
  danger: "bg-danger-500/10 text-danger-500",
  neutral: "bg-surface-muted text-ink-muted",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
