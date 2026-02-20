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
      <div className="hidden max-h-[600px] overflow-y-auto md:block border-b border-stroke">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Organización</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Global</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">
                {canManage ? "Acciones" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-t border-stroke">
                <td className="px-3 py-2.5 font-semibold text-ink">
                  {user.email}
                </td>
                <td className="px-3 py-2.5 text-ink">
                  {user.fullName ?? "Sin nombre"}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {user.memberships.length > 0 ? (
                    <div className="inline-flex items-center gap-2">
                      <span>{user.memberships[0].organizationName}</span>
                      {user.memberships.length > 1 ? (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
                          +{user.memberships.length - 1}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    "Sin asignación"
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {user.memberships.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {user.memberships.map((m) => (
                        <div key={m.organizationId}>{m.role}</div>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {user.globalRoles.length ? user.globalRoles.join(", ") : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={user.isActive ? "success" : "neutral"}>
                    {user.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((user) => (
          <div
            key={user.id}
            className="rounded-lg border border-stroke bg-white p-5"
          >
            <p className="text-sm font-semibold text-ink">{user.email}</p>
            <p className="text-xs text-ink-soft">
              {user.fullName ?? "Sin nombre"}
            </p>
            <div className="mt-3 flex flex-col gap-2 text-xs text-ink-muted">
              {user.memberships.length > 0 ? (
                user.memberships.map((m) => (
                  <div key={m.organizationId} className="flex items-center gap-2">
                    <span>
                      {m.organizationSlug} · {m.organizationName}
                    </span>
                    <span>·</span>
                    <span className="capitalize">{m.role}</span>
                  </div>
                ))
              ) : (
                <span>Sin asignación</span>
              )}
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
        ))}
      </div>
    </>
  );
}
