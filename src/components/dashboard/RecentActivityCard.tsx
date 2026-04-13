import { Card } from "../ui/Card";

type RecentActivityCardProps = {
  items: Array<{
    id: string;
    type: "run" | "bug" | "test_case" | "test_suite" | "artifact";
    title: string;
    detail: string;
    when: string;
  }>;
};

const typeLabel: Record<RecentActivityCardProps["items"][number]["type"], string> = {
  run: "Run",
  bug: "Bug",
  test_case: "Case",
  test_suite: "Suite",
  artifact: "Artifact",
};

export function RecentActivityCard({ items }: RecentActivityCardProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Recent Activity</p>
        <p className="mt-1 text-xs text-ink-muted">Latest 10 available events</p>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-3 text-center text-sm text-ink-muted">
            No recent activity available
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-ink">{item.title}</p>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                  {typeLabel[item.type]}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-ink-muted">{item.detail}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{item.when}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
