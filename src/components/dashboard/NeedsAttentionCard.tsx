import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

type InsightTone = "danger" | "warning" | "info";

type InsightItem = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  tone: InsightTone;
};

type NeedsAttentionCardProps = {
  items: InsightItem[];
};

const toneClassMap: Record<InsightTone, string> = {
  danger: "border-danger-500/25 bg-danger-100/35",
  warning: "border-warning-500/30 bg-warning-500/8",
  info: "border-accent-500/25 bg-accent-500/8",
};

const toneBadgeMap: Record<InsightTone, "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

const toneLabelMap: Record<InsightTone, string> = {
  danger: "Alta",
  warning: "Media",
  info: "Info",
};

export function NeedsAttentionCard({ items }: NeedsAttentionCardProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Needs attention</p>
        <p className="mt-1 text-xs text-ink-muted">Operational signals that need action</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-success-500/30 bg-success-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-success-500">No priority alerts</p>
            <p className="mt-1 text-xs text-ink-muted">
              Manual execution and defect signals look stable this week.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`rounded-lg border px-3.5 py-2.5 ${toneClassMap[item.tone]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <Badge tone={toneBadgeMap[item.tone]} className="px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                  {toneLabelMap[item.tone]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{item.detail}</p>
              <p className="mt-1.5 text-xs font-semibold text-ink-soft">{item.cta}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
