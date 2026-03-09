"use client";

import { Button } from "@/components/ui/Button";

type ManagerErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ManagerError({ error, reset }: ManagerErrorProps) {
  return (
    <div className="rounded-2xl border border-danger-500/30 bg-danger-100/70 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-danger-700">
        Dashboard unavailable
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">
        No se pudieron cargar las métricas principales
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Intenta recargar el panel. Si el problema persiste, revisa la conexión a base de datos y los servicios de ejecución.
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        Detalle técnico: {error.message || "Error desconocido"}
      </p>
      <div className="mt-5">
        <Button variant="danger" onClick={reset}>
          Reintentar carga
        </Button>
      </div>
    </div>
  );
}
