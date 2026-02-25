"use client";

import type { OrgRole } from "@/generated/prisma/client";
import { Badge } from "../ui/Badge";
import { IconEdit, IconTrash } from "../icons";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import type { MemberRecord, MemberSortBy, SortDir } from "./types";

type MembersTableProps = {
  items: MemberRecord[];
  loading: boolean;
  canManage: boolean;
  onEdit?: (member: MemberRecord) => void;
  onRemove?: (member: MemberRecord) => void;
  sortBy: MemberSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: MemberSortBy) => void;
};

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Admin",
  member: "Miembro",
  billing: "Facturación",
};

const ROLE_TONES: Record<OrgRole, "warning" | "success" | "neutral"> = {
  owner: "warning",
  admin: "success",
  member: "neutral",
  billing: "neutral",
};

export function MembersTable({
  items,
  loading,
  canManage,
  onEdit,
  onRemove,
  sortBy,
  sortDir,
  onSort,
}: MembersTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando miembros...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay miembros para mostrar.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden max-h-[600px] overflow-y-auto md:block border-b border-stroke">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label="Nombre"
                sortKey="name"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Email"
                sortKey="email"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Rol"
                sortKey="role"
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
            {items.map((member) => (
              <tr key={member.userId} className="border-t border-stroke">
                <td className="px-3 py-2.5 font-semibold text-ink">
                  {member.user.fullName ?? "Sin nombre"}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">{member.user.email}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={ROLE_TONES[member.role]}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={member.user.isActive ? "success" : "neutral"}>
                    {member.user.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit?.(member)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                        aria-label="Editar miembro"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRemove?.(member)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-danger-50 hover:text-danger-500"
                        aria-label="Eliminar miembro"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-4 md:hidden">
        {items.map((member) => (
          <div
            key={member.userId}
            className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-5"
          >
            <p className="text-sm font-semibold text-ink">
              {member.user.fullName ?? "Sin nombre"}
            </p>
            <p className="text-xs text-ink-soft">{member.user.email}</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={ROLE_TONES[member.role]}>
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
              <Badge tone={member.user.isActive ? "success" : "neutral"}>
                {member.user.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            {canManage && (
              <div className="mt-3 flex items-center justify-end gap-1">
                <button
                  onClick={() => onEdit?.(member)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Editar miembro"
                >
                  <IconEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onRemove?.(member)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-danger-50 hover:text-danger-500"
                  aria-label="Eliminar miembro"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
