import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const timeline = [
  { title: "Checkout web", status: "Completado", tone: "success" as const },
  { title: "Login mobile", status: "Fallido", tone: "danger" as const },
  { title: "Latencia API", status: "Bloqueado", tone: "warning" as const },
  { title: "Settings UI", status: "Completado", tone: "success" as const },
];

export function ActivityCard() {
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Ultimas ejecuciones</p>
          <p className="mt-1 text-xs text-ink-muted">Hoy, {today}</p>
        </div>
        <Badge tone="info">Live</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {timeline.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-lg border border-stroke bg-surface-muted/60 px-4 py-3 dark:bg-surface/60"
          >
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <Badge tone={item.tone}>{item.status}</Badge>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">
          Salud del pipeline
        </p>
        <p className="mt-2 text-lg font-semibold">96% tasa de exito</p>
      </div>
    </Card>
  );
}
