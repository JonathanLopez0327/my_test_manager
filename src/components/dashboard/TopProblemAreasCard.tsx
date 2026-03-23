import { Card } from "../ui/Card";

type TopProblemAreasCardProps = {
  suites: Array<{ suiteName: string; failedCount: number }>;
  testCases: Array<{ testCaseId: string; testCaseTitle: string; linkedBugs: number }>;
};

export function TopProblemAreasCard({ suites, testCases }: TopProblemAreasCardProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Top Problem Areas</p>
        <p className="mt-1 text-xs text-ink-muted">Prioritized by failures and linked defects</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Suites with most failures
          </p>
          <div className="mt-2 space-y-2">
            {suites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stroke bg-surface-muted/40 px-3 py-3">
                <p className="text-xs font-semibold text-ink">No suite hotspots detected</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Failures are currently distributed without a dominant risky suite.
                </p>
              </div>
            ) : (
              suites.map((suite, index) => (
                <div
                  key={`${suite.suiteName}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2"
                >
                  <p className="truncate pr-3 text-xs font-medium text-ink">{suite.suiteName}</p>
                  <span className="shrink-0 rounded-full bg-danger-100 px-2 py-0.5 text-[11px] font-semibold text-danger-500">
                    {suite.failedCount} failed
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Test cases with most linked bugs
          </p>
          <div className="mt-2 space-y-2">
            {testCases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stroke bg-surface-muted/40 px-3 py-3">
                <p className="text-xs font-semibold text-ink">No test case bug hotspots</p>
                <p className="mt-1 text-xs text-ink-muted">
                  No case has concentrated linked defects in the current scope.
                </p>
              </div>
            ) : (
              testCases.map((testCase) => (
                <div
                  key={testCase.testCaseId}
                  className="flex items-center justify-between rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2"
                >
                  <p className="truncate pr-3 text-xs font-medium text-ink">{testCase.testCaseTitle}</p>
                  <span className="shrink-0 rounded-full bg-warning-500/15 px-2 py-0.5 text-[11px] font-semibold text-warning-500">
                    {testCase.linkedBugs} bugs
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
