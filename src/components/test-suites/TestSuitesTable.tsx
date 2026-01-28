"use client";

import { IconEdit, IconTrash } from "../icons";
import type { TestSuiteRecord } from "./types";

type TestSuitesTableProps = {
  items: TestSuiteRecord[];
  loading: boolean;
  onEdit: (suite: TestSuiteRecord) => void;
  onDelete: (suite: TestSuiteRecord) => void;
  canManage?: boolean;
};

function getParentLabel(suite: TestSuiteRecord) {
  return suite.parent?.name ?? "Raíz";
}

export function TestSuitesTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
}: TestSuitesTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando suites...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay suites de prueba para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-ink-soft">
              <th className="px-4 py-3">Suite</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Padre</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((suite) => (
              <tr key={suite.id} className="border-t border-stroke">
                <td className="px-4 py-4">
                  <p className="font-semibold text-ink">{suite.name}</p>
                  <p className="text-xs text-ink-muted">
                    {suite.description ?? "Sin descripción"}
                  </p>
                </td>
                <td className="px-4 py-4 text-ink">
                  <p className="font-semibold">{suite.testPlan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {suite.testPlan.project.key} · {suite.testPlan.project.name}
                  </p>
                </td>
                <td className="px-4 py-4 text-ink-muted">
                  {getParentLabel(suite)}
                </td>
                <td className="px-4 py-4 text-ink-muted">
                  {suite.displayOrder}
                </td>
                <td className="px-4 py-4">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(suite)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                        aria-label="Editar suite"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(suite)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                        aria-label="Eliminar suite"
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
        {items.map((suite) => (
          <div
            key={suite.id}
            className="rounded-lg border border-stroke bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {suite.testPlan.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">{suite.name}</p>
              </div>
              <span className="text-xs font-semibold text-ink-muted">
                Orden {suite.displayOrder}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {suite.testPlan.name} · {suite.testPlan.project.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {suite.description ?? "Sin descripción"}
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              Padre: {getParentLabel(suite)}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => onEdit(suite)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Editar suite"
                >
                  <IconEdit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(suite)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                  aria-label="Eliminar suite"
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
