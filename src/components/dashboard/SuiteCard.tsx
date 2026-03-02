import { Card } from "../ui/Card";

type SuiteData = {
  name: string;
  cases: number;
  trend: string;
};

type SuiteCardProps = {
  suites: SuiteData[];
};

export function SuiteCard({ suites }: SuiteCardProps) {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Suites con más actividad</p>
        <span className="text-xs text-ink-muted">Este mes</span>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {suites.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Sin actividad reciente</p>
        ) : (
          suites.map((suite) => (
            <div key={suite.name} className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{suite.name}</p>
                <p className="text-xs text-ink-soft">{suite.cases} ejecuciones</p>
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {suite.trend}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
