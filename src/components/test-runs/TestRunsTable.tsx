"use client";

import { IconClipboard, IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import type { TestRunRecord, TestRunStatus, TestRunType } from "./types";

type TestRunsTableProps = {
  items: TestRunRecord[];
  loading: boolean;
  onView: (run: TestRunRecord) => void;
  onEdit: (run: TestRunRecord) => void;
  onDelete: (run: TestRunRecord) => void;
  canManage?: boolean;
};

const statusLabels: Record<TestRunStatus, string> = {
  queued: "En cola",
  running: "En ejecución",
  completed: "Completado",
  canceled: "Cancelado",
  failed: "Fallido",
};

const statusTones: Record<
  TestRunStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  queued: "neutral",
  running: "warning",
  completed: "success",
  canceled: "neutral",
  failed: "danger",
};

const runTypeLabels: Record<TestRunType, string> = {
  manual: "Manual",
  automated: "Automatizado",
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString();
}

function getRunTitle(run: TestRunRecord) {
  if (run.name?.trim()) return run.name.trim();
  return `Run ${run.id.slice(0, 6)}`;
}

export function TestRunsTable({
  items,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage = true,
}: TestRunsTableProps) {
  if (loading) {
    return (
      <div className="grid gap-3 py-2">
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-14 animate-pulse rounded-lg border border-stroke bg-surface-muted/80"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-strong bg-surface-muted/50 px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">No hay ejecuciones para mostrar.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Crea un nuevo run o ajusta filtros para encontrar resultados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[600px] overflow-y-auto md:block">
        <table className="w-full border-separate border-spacing-y-1 text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <th className="px-3 py-2">Run</th>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Plan / Suite</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Métricas</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Fechas</th>
              <th className="px-3 py-2 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((run) => (
              <tr key={run.id} className="transition-colors hover:bg-brand-50/35">
                <td className="rounded-l-xl border-y border-l border-stroke bg-surface px-3 py-3">
                  <p className="font-semibold text-ink">{getRunTitle(run)}</p>
                  <p className="text-xs text-ink-muted">
                    {run.environment ?? "Sin ambiente"} ·{" "}
                    {run.buildNumber ?? "Sin build"}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {run.branch ?? "Sin branch"}
                  </p>
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-ink">
                  <p className="font-semibold">
                    {run.project.key} · {run.project.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.commitSha ? run.commitSha.slice(0, 10) : "Sin commit"}
                  </p>
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-ink-muted">
                  <p className="font-semibold text-ink">
                    {run.testPlan?.name ?? run.suite?.testPlan.name ?? "Sin plan"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.suite?.name ?? "Sin suite"}
                  </p>
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3">
                  <Badge tone={statusTones[run.status]}>
                    {statusLabels[run.status]}
                  </Badge>
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-xs text-ink-muted">
                  {run.metrics ? (
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {run.metrics.passRate}%
                      </p>
                      <p>
                        {run.metrics.passed}/{run.metrics.total} pasados
                      </p>
                    </div>
                  ) : (
                    <span className="text-ink-soft">Sin métricas</span>
                  )}
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-ink-muted">
                  {runTypeLabels[run.runType]}
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-xs text-ink-muted">
                  <p>Inicio: {formatDate(run.startedAt)}</p>
                  <p>Fin: {formatDate(run.finishedAt)}</p>
                </td>
                <td className="rounded-r-xl border-y border-r border-stroke bg-surface px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(run)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Ver detalles del run"
                    >
                      <IconClipboard className="h-4 w-4" />
                    </button>
                    {canManage ? (
                      <>
                        <button
                          onClick={() => onEdit(run)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Editar run"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(run)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-danger-500 transition-all duration-200 ease-[var(--ease-emphasis)] hover:bg-danger-500/10"
                          aria-label="Eliminar run"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border border-stroke bg-surface-elevated p-5 shadow-soft-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {run.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {getRunTitle(run)}
                </p>
              </div>
              <Badge tone={statusTones[run.status]}>
                {statusLabels[run.status]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {run.testPlan?.name ?? run.suite?.testPlan.name ?? "Sin plan"} ·{" "}
              {run.suite?.name ?? "Sin suite"}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {run.environment ?? "Sin ambiente"} ·{" "}
              {run.buildNumber ?? "Sin build"}
            </p>
            <div className="mt-3 text-sm text-ink-muted">
              {run.metrics ? (
                <p>
                  Métricas: {run.metrics.passRate}% · {run.metrics.passed}/
                  {run.metrics.total} pasados
                </p>
              ) : (
                <p className="text-ink-soft">Métricas: sin datos</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
              <span>{runTypeLabels[run.runType]}</span>
              <span>{run.branch ?? "Sin branch"}</span>
              <span>
                {run.commitSha ? run.commitSha.slice(0, 10) : "Sin commit"}
              </span>
            </div>
            <div className="mt-3 text-xs text-ink-muted">
              <p>Inicio: {formatDate(run.startedAt)}</p>
              <p>Fin: {formatDate(run.finishedAt)}</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => onView(run)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:bg-brand-50 hover:text-brand-700"
                aria-label="Ver detalles del run"
              >
                <IconClipboard className="h-5 w-5" />
              </button>
              {canManage ? (
                <>
                  <button
                    onClick={() => onEdit(run)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:bg-brand-50 hover:text-brand-700"
                    aria-label="Editar run"
                  >
                    <IconEdit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onDelete(run)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stroke text-danger-500 transition-all duration-200 ease-[var(--ease-emphasis)] hover:bg-danger-500/10"
                    aria-label="Eliminar run"
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
