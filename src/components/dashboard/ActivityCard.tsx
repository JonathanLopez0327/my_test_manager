import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { IconChevronRight } from "../icons";

type RunItem = {
  id: string;
  title: string;
  suite: string;
  environment: string;
  when: string;
  duration: string;
  tests: string;
  outcome: string;
  status: string;
  tone: "success" | "danger" | "warning" | "info" | "neutral";
};

type ActivityCardProps = {
  runs: RunItem[];
  passRate: number;
};

export function ActivityCard({ runs, passRate }: ActivityCardProps) {
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Últimas ejecuciones</p>
          <p className="mt-1 text-xs text-ink-muted">Actividad operativa, {today}</p>
        </div>
        <Badge tone="info">Live</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {runs.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Sin ejecuciones recientes</p>
        ) : (
          runs.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-stroke bg-surface-muted/60 px-4 py-3.5 transition-colors hover:bg-brand-50/40 dark:bg-surface/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <Badge tone={item.tone} className="px-2.5 py-0.5 text-[10px] uppercase tracking-[0.13em]">
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-ink-muted">
                  {item.suite} · {item.environment} · {item.when}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {item.duration} · {item.tests} · {item.outcome}
                </p>
              </div>
              <IconChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
            </div>
          ))
        )}
      </div>
      <div className="mt-auto pt-5">
        <div className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-4 text-white shadow-soft-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">
            Salud del pipeline
          </p>
          <p className="mt-2 text-lg font-semibold">{passRate}% tasa de éxito</p>
        </div>
      </div>
    </Card>
  );
}
