"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import type { TestPlanRecord, TestPlanStatus } from "./types";

type TestPlansTableProps = {
  items: TestPlanRecord[];
  loading: boolean;
  onEdit: (plan: TestPlanRecord) => void;
  onDelete: (plan: TestPlanRecord) => void;
  canManage?: boolean;
};

const statusLabels: Record<TestPlanStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
};

const statusTones: Record<TestPlanStatus, "success" | "warning" | "danger" | "neutral"> =
{
  draft: "neutral",
  active: "success",
  completed: "warning",
  archived: "danger",
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";
  return dateFormatter.format(parsed);
}

function getRangeText(plan: TestPlanRecord) {
  const start = plan.startsOn ? formatDate(plan.startsOn) : null;
  const end = plan.endsOn ? formatDate(plan.endsOn) : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return `Desde ${start}`;
  if (end) return `Hasta ${end}`;
  return "Sin fechas";
}

export function TestPlansTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
}: TestPlansTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando planes...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay planes de prueba para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[600px] overflow-y-auto md:block border-b border-stroke">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fechas</th>
              <th className="px-3 py-2 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((plan) => (
              <tr key={plan.id} className="border-t border-stroke">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {plan.description ?? "Sin descripción"}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink">
                  <p className="font-semibold">{plan.project.key}</p>
                  <p className="text-xs text-ink-muted">{plan.project.name}</p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={statusTones[plan.status]}>
                    {statusLabels[plan.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {getRangeText(plan)}
                </td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(plan)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                        aria-label="Editar plan"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(plan)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                        aria-label="Eliminar plan"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((plan) => (
          <div
            key={plan.id}
            className="rounded-lg border border-stroke bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {plan.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">{plan.name}</p>
              </div>
              <Badge tone={statusTones[plan.status]}>
                {statusLabels[plan.status]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {plan.project.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {plan.description ?? "Sin descripción"}
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              {getRangeText(plan)}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => onEdit(plan)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Editar plan"
                >
                  <IconEdit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(plan)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                  aria-label="Eliminar plan"
                >
                  <IconTrash className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
