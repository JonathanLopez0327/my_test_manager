"use client";

import { IconEdit } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import type { UserRecord, UserSortBy, SortDir } from "./types";
import { useT } from "@/lib/i18n/LocaleProvider";

type UsersTableProps = {
  items: UserRecord[];
  loading: boolean;
  onEdit?: (user: UserRecord) => void;
  canManage?: boolean;
  showGlobal?: boolean;
  sortBy: UserSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: UserSortBy) => void;
};

export function UsersTable({
  items,
  loading,
  onEdit,
  canManage = false,
  showGlobal = false,
  sortBy,
  sortDir,
  onSort,
}: UsersTableProps) {
  const t = useT();
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle={t.users.emptyTitle}
      emptyDescription={t.users.emptyDescription}
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label={t.users.columns.email}
                sortKey="email"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.users.columns.name}
                sortKey="fullName"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.users.columns.organization}
                sortKey="organization"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.users.columns.role}
                sortKey="role"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              {showGlobal ? (
                <SortableHeaderCell
                  label={t.users.columns.global}
                  sortKey="global"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={onSort}
                />
              ) : null}
              <SortableHeaderCell
                label={t.common.status}
                sortKey="isActive"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">
                {canManage ? t.common.actions : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-brand-50/35"
              >
                <td className="px-3 py-2.5 font-semibold text-ink">
                  {user.email}
                </td>
                <td className="px-3 py-2.5 text-ink">
                  {user.fullName ?? t.users.unnamed}
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
                    t.users.unassigned
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
                {showGlobal ? (
                  <td className="px-3 py-2.5 text-ink-muted">
                    {user.globalRoles.length ? user.globalRoles.join(", ") : "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2.5">
                  <Badge tone={user.isActive ? "success" : "neutral"}>
                    {user.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    <div className="flex items-center justify-end">
                      <RowActionButton
                        onClick={() => onEdit?.(user)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label={t.users.editUser}
                        title={t.users.editUser}
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
          {items.map((user) => (
            <div
              key={user.id}
              className="rounded-lg bg-surface-elevated p-5 shadow-sm dark:bg-surface-muted"
            >
              <p className="text-sm font-semibold text-ink">{user.email}</p>
              <p className="text-xs text-ink-soft">
                {user.fullName ?? t.users.unnamed}
              </p>
              <div className="mt-3 flex flex-col gap-2 text-xs text-ink-muted">
                {user.memberships.length > 0 ? (
                  user.memberships.map((m) => (
                    <div
                      key={m.organizationId}
                      className="flex items-center gap-2"
                    >
                      <span>
                        {m.organizationSlug} · {m.organizationName}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{m.role}</span>
                    </div>
                  ))
                ) : (
                  <span>{t.users.unassigned}</span>
                )}
              </div>
              {showGlobal && user.globalRoles.length ? (
                <p className="mt-2 text-xs text-ink-muted">
                  {t.users.globalPrefix}: {user.globalRoles.join(", ")}
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <Badge tone={user.isActive ? "success" : "neutral"}>
                  {user.isActive ? t.common.active : t.common.inactive}
                </Badge>
                {canManage ? (
                  <RowActionButton
                    onClick={() => onEdit?.(user)}
                    icon={<IconEdit className="h-4 w-4" />}
                    label={t.users.editUser}
                    title={t.users.editUser}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </>
      }
    />
  );
}
