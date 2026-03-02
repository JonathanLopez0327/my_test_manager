"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
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
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle="No projects found."
      emptyDescription="Adjust your filters or create a new project."
      desktop={
        <table className="w-full border-collapse text-[13px]">
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
                label="Name"
                sortKey="name"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Description"
                sortKey="description"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Status"
                sortKey="isActive"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">{canManage ? "Actions" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((project) => (
              <tr key={project.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3 font-semibold text-ink">
                  {project.key}
                </td>
                <td className="px-3 py-3 text-ink">
                  {project.name}
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {project.description ?? "No description"}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={project.isActive ? "success" : "neutral"}>
                    {project.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <RowActionButton
                        onClick={() => onEdit(project)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label="Edit project"
                      />
                      <RowActionButton
                        onClick={() => onDelete(project)}
                        icon={<IconTrash className="h-4 w-4" />}
                        label="Delete project"
                        tone="danger"
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      mobile={
        <>
          {items.map((project) => (
            <div
              key={project.id}
              className="rounded-lg bg-surface-elevated p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                    {project.key}
                  </p>
                  <p className="text-lg font-semibold text-ink">{project.name}</p>
                </div>
                <Badge tone={project.isActive ? "success" : "neutral"}>
                  {project.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                {project.description ?? "No description"}
              </p>
              {canManage ? (
                <div className="mt-4 flex items-center gap-3">
                  <RowActionButton
                    onClick={() => onEdit(project)}
                    icon={<IconEdit className="h-5 w-5" />}
                    label="Edit project"
                    size="md"
                  />
                  <RowActionButton
                    onClick={() => onDelete(project)}
                    icon={<IconTrash className="h-5 w-5" />}
                    label="Delete project"
                    tone="danger"
                    size="md"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </>
      }
    />
  );
}
