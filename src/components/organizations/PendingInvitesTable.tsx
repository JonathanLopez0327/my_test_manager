"use client";

import type { OrgRole } from "@/generated/prisma/client";
import { Badge } from "../ui/Badge";
import { IconTrash } from "../icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";

export type PendingInviteRecord = {
  id: string;
  email: string;
  role: OrgRole;
  status: "pending" | "consumed" | "revoked" | "expired";
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; fullName: string | null; email: string } | null;
};

type PendingInvitesTableProps = {
  items: PendingInviteRecord[];
  loading: boolean;
  canManage: boolean;
  onCopy: (inviteId: string) => void;
  onRevoke: (invite: PendingInviteRecord) => void;
  copiedId: string | null;
};

function roleLabel(role: OrgRole, t: Messages): string {
  return t.organizations.roles[role] ?? role;
}

function formatExpiry(expiresAt: string, t: Messages): string {
  const expires = new Date(expiresAt);
  const now = Date.now();
  const diffMs = expires.getTime() - now;
  if (diffMs <= 0) return t.organizations.inviteExpired;
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) {
    return formatMessage(
      days === 1 ? t.organizations.expiresInDay : t.organizations.expiresInDays,
      { count: days },
    );
  }
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) {
    return formatMessage(
      hours === 1 ? t.organizations.expiresInHour : t.organizations.expiresInHours,
      { count: hours },
    );
  }
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return formatMessage(t.organizations.expiresInMinutes, { count: minutes });
}

export function PendingInvitesTable({
  items,
  loading,
  canManage,
  onCopy,
  onRevoke,
  copiedId,
}: PendingInvitesTableProps) {
  const t = useT();
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-ink-muted">
        <span className="h-8 w-8 animate-pulse rounded-full bg-brand-100" />
        {t.organizations.loadingInvites}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-sm text-ink-muted">
        {t.organizations.noPendingInvites}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
          <tr className="text-left text-[13px] font-medium text-ink-soft">
            <th className="px-3 py-2">{t.organizations.invitesColumns.email}</th>
            <th className="px-3 py-2">{t.organizations.invitesColumns.role}</th>
            <th className="px-3 py-2">{t.organizations.invitesColumns.expires}</th>
            <th className="px-3 py-2">{t.organizations.invitesColumns.invitedBy}</th>
            <th className="px-3 py-2 text-right">{t.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((invite) => {
            const expired = new Date(invite.expiresAt).getTime() <= Date.now();
            return (
              <tr key={invite.id}>
                <td className="px-3 py-2.5 font-semibold text-ink">
                  {invite.email}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone="neutral">
                    {roleLabel(invite.role, t)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {expired ? (
                    <Badge tone="danger">{t.organizations.inviteExpired}</Badge>
                  ) : (
                    formatExpiry(invite.expiresAt, t)
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {invite.invitedBy?.fullName ?? invite.invitedBy?.email ?? "-"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {!expired && (
                      <button
                        onClick={() => onCopy(invite.id)}
                        className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                      >
                        {copiedId === invite.id ? t.organizations.copied : t.organizations.copyLink}
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => onRevoke(invite)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-danger-50 hover:text-danger-500"
                        aria-label={t.organizations.revokeInvite}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
