import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

type RecentBugsCardProps = {
  bugs: Array<{
    id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    status: "open" | "in_progress" | "resolved" | "verified" | "closed" | "reopened";
    createdAt: Date;
  }>;
};

const severityToneMap: Record<
  "critical" | "high" | "medium" | "low",
  "danger" | "warning" | "neutral"
> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "neutral",
};

export function RecentBugsCard({ bugs }: RecentBugsCardProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Recent Bugs</p>
        <p className="mt-1 text-xs text-ink-muted">Latest 5 bug reports</p>
      </div>

      <div className="mt-4 space-y-2">
        {bugs.length === 0 ? (
          <p className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-3 text-center text-sm text-ink-muted">
            No recent bugs
          </p>
        ) : (
          bugs.map((bug) => (
            <div
              key={bug.id}
              className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-ink">
                  {bug.id.slice(0, 8)} · {bug.title}
                </p>
                <Badge tone={severityToneMap[bug.severity]} className="px-2 py-0 text-[10px] uppercase">
                  {bug.severity}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                {bug.status.replace("_", " ")} · {bug.createdAt.toLocaleDateString("es-ES")}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
