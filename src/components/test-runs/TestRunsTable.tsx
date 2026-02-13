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
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando ejecuciones...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay ejecuciones para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
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
              <tr key={run.id} className="border-t border-stroke">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{getRunTitle(run)}</p>
                  <p className="text-xs text-ink-muted">
                    {run.environment ?? "Sin ambiente"} ·{" "}
                    {run.buildNumber ?? "Sin build"}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {run.branch ?? "Sin branch"}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink">
                  <p className="font-semibold">
                    {run.project.key} · {run.project.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.commitSha ? run.commitSha.slice(0, 10) : "Sin commit"}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  <p className="font-semibold text-ink">
                    {run.testPlan?.name ?? run.suite?.testPlan.name ?? "Sin plan"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.suite?.name ?? "Sin suite"}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={statusTones[run.status]}>
                    {statusLabels[run.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-muted">
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
                <td className="px-3 py-2.5 text-ink-muted">
                  {runTypeLabels[run.runType]}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-muted">
                  <p>Inicio: {formatDate(run.startedAt)}</p>
                  <p>Fin: {formatDate(run.finishedAt)}</p>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(run)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Ver detalles del run"
                    >
                      <IconClipboard className="h-4 w-4" />
                    </button>
                    {canManage ? (
                      <>
                        <button
                          onClick={() => onEdit(run)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Editar run"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(run)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
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
            className="rounded-lg border border-stroke bg-white p-5"
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                aria-label="Ver detalles del run"
              >
                <IconClipboard className="h-5 w-5" />
              </button>
              {canManage ? (
                <>
                  <button
                    onClick={() => onEdit(run)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                    aria-label="Editar run"
                  >
                    <IconEdit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onDelete(run)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
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
