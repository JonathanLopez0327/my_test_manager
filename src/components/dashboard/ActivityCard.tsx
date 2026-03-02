import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

type RunItem = {
  title: string;
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
          <p className="mt-1 text-xs text-ink-muted">Hoy, {today}</p>
        </div>
        <Badge tone="info">Live</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {runs.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Sin ejecuciones recientes</p>
        ) : (
          runs.map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-lg border border-stroke bg-surface-muted/60 px-4 py-3 dark:bg-surface/60"
            >
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <Badge tone={item.tone}>{item.status}</Badge>
            </div>
          ))
        )}
      </div>
      <div className="mt-auto pt-5">
        <div className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">
            Salud del pipeline
          </p>
          <p className="mt-2 text-lg font-semibold">{passRate}% tasa de éxito</p>
        </div>
      </div>
    </Card>
  );
}
