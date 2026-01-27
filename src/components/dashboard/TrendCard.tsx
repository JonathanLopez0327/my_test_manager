import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const bars = [36, 58, 44, 72, 49, 65, 53];

export function TrendCard() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Run Success Trend</p>
          <p className="mt-1 text-xs text-ink-muted">
            Automated + manual runs over the last 7 days
          </p>
        </div>
        <Badge tone="neutral">Weekly</Badge>
      </div>
      <div className="mt-6 flex h-32 items-end gap-3">
        {bars.map((value, index) => (
          <div key={`bar-${index}`} className="flex-1">
            <div className="h-full rounded-full bg-brand-100/60 p-1">
              <div
                className="w-full rounded-full bg-gradient-to-t from-brand-600 to-brand-300"
                style={{ height: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Passed
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-300" />
          Failed
        </span>
      </div>
    </Card>
  );
}
