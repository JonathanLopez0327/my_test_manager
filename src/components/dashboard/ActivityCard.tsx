import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const timeline = [
  { title: "Checkout flow", status: "Passed", tone: "success" as const },
  { title: "Mobile login", status: "Failed", tone: "danger" as const },
  { title: "API latency", status: "Blocked", tone: "warning" as const },
  { title: "Settings UI", status: "Passed", tone: "success" as const },
];

export function ActivityCard() {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Latest Test Runs</p>
          <p className="mt-1 text-xs text-ink-muted">Today, 27 January 2026</p>
        </div>
        <Badge tone="neutral">Live</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {timeline.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-2xl border border-stroke bg-surface-muted/60 px-4 py-3"
          >
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <Badge tone={item.tone}>{item.status}</Badge>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-3xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">
          Pipeline Health
        </p>
        <p className="mt-2 text-lg font-semibold">96% success rate</p>
      </div>
    </Card>
  );
}
