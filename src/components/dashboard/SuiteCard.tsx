import { Card } from "../ui/Card";

const suites = [
  { name: "Checkout Suite", cases: 148, trend: "+12" },
  { name: "Auth & SSO", cases: 96, trend: "+6" },
  { name: "Mobile QA", cases: 72, trend: "+4" },
  { name: "Analytics", cases: 52, trend: "+2" },
];

export function SuiteCard() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Top Suites</p>
        <span className="text-xs text-ink-muted">This month</span>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {suites.map((suite) => (
          <div key={suite.name} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{suite.name}</p>
              <p className="text-xs text-ink-soft">{suite.cases} cases</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {suite.trend}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
