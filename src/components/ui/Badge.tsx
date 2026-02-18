import type { HTMLAttributes } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const tones: Record<BadgeTone, string> = {
  success: "border border-success-500/25 bg-success-500/10 text-success-500",
  warning: "border border-warning-500/25 bg-warning-500/10 text-warning-500",
  danger: "border border-danger-500/25 bg-danger-500/10 text-danger-500",
  neutral: "border border-stroke bg-surface-muted text-ink-muted",
  info: "border border-accent-500/25 bg-accent-500/10 text-accent-600",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
