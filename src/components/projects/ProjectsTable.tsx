"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import type { ProjectRecord, ProjectSortBy, SortDir } from "./types";

type ProjectsTableProps = {
  items: ProjectRecord[];
  loading: boolean;
  onEdit: (project: ProjectRecord) => void;
  onDelete: (project: ProjectRecord) => void;
  canManage?: boolean;
  sortBy: ProjectSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: ProjectSortBy) => void;
};

export function ProjectsTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
}: ProjectsTableProps) {
  if (loading) {
    return (
      <div className="grid gap-3 py-2">
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-12 animate-pulse rounded-lg border border-stroke bg-surface-muted/80"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-strong bg-surface-muted/50 px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">No hay proyectos para mostrar.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Ajusta tus filtros o crea un nuevo proyecto para comenzar.
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
              <SortableHeaderCell
                label="Key"
                sortKey="key"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Nombre"
                sortKey="name"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Descripción"
                sortKey="description"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Estado"
                sortKey="isActive"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((project) => (
              <tr
                key={project.id}
                className="rounded-lg transition-colors hover:bg-brand-50/35"
              >
                <td className="rounded-l-xl border-y border-l border-stroke bg-surface px-3 py-3 font-semibold text-ink">
                  {project.key}
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-ink">{project.name}</td>
                <td className="border-y border-stroke bg-surface px-3 py-3 text-ink-muted">
                  {project.description ?? "Sin descripción"}
                </td>
                <td className="border-y border-stroke bg-surface px-3 py-3">
                  <Badge tone={project.isActive ? "success" : "neutral"}>
                    {project.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="rounded-r-xl border-y border-r border-stroke bg-surface px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(project)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        aria-label="Editar proyecto"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(project)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-danger-500 transition-all duration-200 ease-[var(--ease-emphasis)] hover:bg-danger-500/10"
                        aria-label="Eliminar proyecto"
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
        {items.map((project) => (
          <div
            key={project.id}
            className="rounded-lg border border-stroke bg-surface-elevated p-5 shadow-soft-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {project.key}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {project.name}
                </p>
              </div>
              <Badge tone={project.isActive ? "success" : "neutral"}>
                {project.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              {project.description ?? "Sin descripción"}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => onEdit(project)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Editar proyecto"
                >
                  <IconEdit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(project)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                  aria-label="Eliminar proyecto"
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
