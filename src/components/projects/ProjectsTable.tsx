"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { ProjectRecord } from "./types";

type ProjectsTableProps = {
  items: ProjectRecord[];
  loading: boolean;
  onEdit: (project: ProjectRecord) => void;
  onDelete: (project: ProjectRecord) => void;
};

export function ProjectsTable({
  items,
  loading,
  onEdit,
  onDelete,
}: ProjectsTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando proyectos...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay proyectos para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-ink-soft">
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((project) => (
              <tr
                key={project.id}
                className="border-t border-stroke"
              >
                <td className="px-4 py-4 font-semibold text-ink">
                  {project.key}
                </td>
                <td className="px-4 py-4 text-ink">{project.name}</td>
                <td className="px-4 py-4 text-ink-muted">
                  {project.description ?? "Sin descripción"}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={project.isActive ? "success" : "neutral"}>
                    {project.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(project)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Editar proyecto"
                    >
                      <IconEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(project)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                      aria-label="Eliminar proyecto"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
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
            className="rounded-lg border border-stroke bg-white p-5"
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
          </div>
        ))}
      </div>
    </>
  );
}
