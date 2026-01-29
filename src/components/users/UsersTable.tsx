"use client";

import { IconEdit } from "../icons";
import { Badge } from "../ui/Badge";
import type { UserRecord } from "./types";

type UsersTableProps = {
  items: UserRecord[];
  loading: boolean;
  onEdit?: (user: UserRecord) => void;
  canManage?: boolean;
};

export function UsersTable({
  items,
  loading,
  onEdit,
  canManage = false,
}: UsersTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Cargando usuarios...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No hay usuarios para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-sm font-medium text-ink-soft">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Global</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => {
              const membership = user.memberships[0];
              return (
                <tr key={user.id} className="border-t border-stroke">
                  <td className="px-4 py-4 font-semibold text-ink">
                    {user.email}
                  </td>
                  <td className="px-4 py-4 text-ink">
                    {user.fullName ?? "Sin nombre"}
                  </td>
                  <td className="px-4 py-4 text-ink-muted">
                    {membership
                      ? `${membership.projectKey} · ${membership.projectName}`
                      : "Sin asignación"}
                  </td>
                  <td className="px-4 py-4 text-ink-muted">
                    {membership?.role ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-ink-muted">
                    {user.globalRoles.length
                      ? user.globalRoles.join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={user.isActive ? "success" : "neutral"}>
                      {user.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {canManage ? (
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => onEdit?.(user)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Editar usuario"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((user) => {
          const membership = user.memberships[0];
          return (
            <div
              key={user.id}
              className="rounded-lg border border-stroke bg-white p-5"
            >
              <p className="text-sm font-semibold text-ink">{user.email}</p>
              <p className="text-xs text-ink-soft">
                {user.fullName ?? "Sin nombre"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span>
                  {membership
                    ? `${membership.projectKey} · ${membership.projectName}`
                    : "Sin asignación"}
                </span>
                <span>·</span>
                <span>{membership?.role ?? "—"}</span>
              </div>
              {user.globalRoles.length ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Global: {user.globalRoles.join(", ")}
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <Badge tone={user.isActive ? "success" : "neutral"}>
                  {user.isActive ? "Activo" : "Inactivo"}
                </Badge>
                {canManage ? (
                  <button
                    onClick={() => onEdit?.(user)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                    aria-label="Editar usuario"
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
