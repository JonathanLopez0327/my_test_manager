import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

type StatCardProps = {
  label: string;
  value: string;
  supportText: string;
  microInsight?: string;
  statusBadge?: {
    tone: "success" | "warning" | "danger" | "neutral" | "info";
    label: string;
  };
  icon: ReactNode;
  accentClassName: string;
  emphasized?: boolean;
  compact?: boolean;
};

export function StatCard({
  label,
  value,
  supportText,
  microInsight,
  statusBadge,
  icon,
  accentClassName,
  emphasized = false,
  compact = false,
}: StatCardProps) {
  return (
    <Card
      className={`overflow-hidden ${emphasized ? "border-brand-300/60 bg-gradient-to-br from-brand-50/50 via-surface-elevated to-surface-elevated shadow-[0_24px_44px_-28px_rgba(74,58,208,0.42)]" : ""}`}
    >
      <div className={`flex items-start justify-between gap-4 ${compact ? "p-5" : "p-6"}`}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
            {label}
          </p>
          <p
            className={`mt-3 ${emphasized ? "text-[38px]" : compact ? "text-[24px]" : "text-[30px]"} font-semibold leading-none text-ink`}
          >
            {value}
          </p>
          <p className={`mt-2 ${compact ? "text-xs" : "text-sm"} text-ink-muted`}>{supportText}</p>
          {microInsight ? (
            <p className="mt-2 text-xs font-medium text-ink-soft">{microInsight}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          {statusBadge ? (
            <Badge tone={statusBadge.tone} className="px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]">
              {statusBadge.label}
            </Badge>
          ) : null}
          <div className={`flex ${compact ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-xl ${accentClassName}`}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}
