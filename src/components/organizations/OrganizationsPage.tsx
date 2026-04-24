"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OrgRole } from "@/generated/prisma/client";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { RefreshIconButton } from "../ui/RefreshIconButton";
import { IconPlus } from "../icons";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { OrganizationDetailsCard } from "./OrganizationDetailsCard";
import { OrganizationEditSheet } from "./OrganizationEditSheet";
import { AiUsageCard } from "./AiUsageCard";
import { MembersTable } from "./MembersTable";
import { MemberFormSheet } from "./MemberFormSheet";
import { SuperAdminOrganizationsView } from "./SuperAdminOrganizationsView";
import { InviteMemberSheet } from "./InviteMemberSheet";
import {
  PendingInvitesTable,
  type PendingInviteRecord,
} from "./PendingInvitesTable";
import type {
  MemberRecord,
  MembersResponse,
  OrganizationDetail,
  OrganizationUpdatePayload,
  MemberSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Unexpected error (HTTP ${res.status})` };
  }
}

export function OrganizationsPage() {
  const { activeOrganizationId } = usePermissions();

  // Users without an active org (i.e. super_admin, who never joins one)
  // get the global organizations listing instead of the active-org detail view.
  if (!activeOrganizationId) {
    return <SuperAdminOrganizationsView />;
  }

  return <ActiveOrgView />;
}

// ─────────────────────────────────────────────────────────────
// Active org detail view (regular users)
// ─────────────────────────────────────────────────────────────

function ActiveOrgView() {
  const { can, activeOrganizationId } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit org sheet
  const [editOrgOpen, setEditOrgOpen] = useState(false);

  // Member form sheet
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);

  // Delete member confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    member: MemberRecord | null;
    isConfirming: boolean;
  }>({ open: false, member: null, isConfirming: false });

  // Invites state
  const [invites, setInvites] = useState<PendingInviteRecord[]>([]);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState<{
    open: boolean;
    invite: PendingInviteRecord | null;
    isConfirming: boolean;
  }>({ open: false, invite: null, isConfirming: false });

  const canUpdate = can(PERMISSIONS.ORG_UPDATE);
  const canListMembers = can(PERMISSIONS.ORG_MEMBER_LIST);
  const canManageMembers = can(PERMISSIONS.ORG_MEMBER_MANAGE);
  const canManageInvites = can(PERMISSIONS.ORG_INVITE_MANAGE);
  const memberSortBy = (searchParams.get("sortBy") as MemberSortBy | null) ?? null;
  const memberSortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const fetchOrg = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const res = await fetch(`/api/organizations/${activeOrganizationId}`);
      if (!res.ok) throw new Error(t.organizations.couldNotLoadOrg);
      const data = (await res.json()) as OrganizationDetail;
      setOrg(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.organizations.errorLoadingData);
    }
  }, [activeOrganizationId, t]);

  const fetchMembers = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const params = new URLSearchParams();
      if (memberSortBy && memberSortDir) {
        params.set("sortBy", memberSortBy);
        params.set("sortDir", memberSortDir);
      }
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/members${params.toString() ? `?${params.toString()}` : ""}`,
      );
      if (!res.ok) throw new Error(t.organizations.couldNotLoadMembers);
      const data = (await res.json()) as MembersResponse;
      setMembers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.organizations.errorLoadingMembers);
    }
  }, [activeOrganizationId, memberSortBy, memberSortDir, t]);

  const fetchInvites = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/invites`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: PendingInviteRecord[] };
      setInvites(data.items ?? []);
    } catch {
      setInvites([]);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!activeOrganizationId) return;
    setLoading(true);
    setError(null);
    const tasks: Promise<unknown>[] = [fetchOrg()];
    if (canListMembers) tasks.push(fetchMembers());
    if (canManageInvites) tasks.push(fetchInvites());
    Promise.all(tasks).finally(() => setLoading(false));
  }, [
    activeOrganizationId,
    canListMembers,
    canManageInvites,
    fetchOrg,
    fetchMembers,
    fetchInvites,
  ]);

  const handleSaveOrg = async (payload: OrganizationUpdatePayload) => {
    if (!activeOrganizationId) return;
    const res = await fetch(`/api/organizations/${activeOrganizationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new Error(data.message || t.organizations.couldNotUpdateOrg);
    }
    await fetchOrg();
  };

  const handleEditMember = (member: MemberRecord) => {
    setEditingMember(member);
    setMemberFormOpen(true);
  };

  const handleRemoveMember = (member: MemberRecord) => {
    setDeleteConfirmation({ open: true, member, isConfirming: false });
  };

  const handleSaveMember = async (
    userId: string,
    role: OrgRole,
    isEdit: boolean,
  ) => {
    if (!activeOrganizationId) return;
    if (isEdit) {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/members/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.organizations.couldNotUpdateMember);
      }
    } else {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.organizations.couldNotAddMember);
      }
    }
    await Promise.all([fetchOrg(), fetchMembers()]);
  };

  const handleConfirmRemove = async () => {
    const member = deleteConfirmation.member;
    if (!member || !activeOrganizationId) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/members/${member.userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.organizations.couldNotRemoveMember);
      }
      await Promise.all([fetchOrg(), fetchMembers()]);
      setDeleteConfirmation({ open: false, member: null, isConfirming: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.organizations.couldNotRemoveMember,
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleCopyInviteLink = async (inviteId: string) => {
    const invite = invites.find((i) => i.id === inviteId);
    if (!invite) return;
    const url = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleRevokeInvite = (invite: PendingInviteRecord) => {
    setRevokeConfirmation({ open: true, invite, isConfirming: false });
  };

  const handleConfirmRevokeInvite = async () => {
    const invite = revokeConfirmation.invite;
    if (!invite || !activeOrganizationId) return;

    setRevokeConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/invites/${invite.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.organizations.couldNotRevokeInvite);
      }
      await fetchInvites();
      setRevokeConfirmation({ open: false, invite: null, isConfirming: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.organizations.couldNotRevokeInvite,
      );
      setRevokeConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleMemberSort = (column: MemberSortBy) => {
    const next = nextSort<MemberSortBy>(memberSortBy, memberSortDir, column);
    const params = new URLSearchParams(searchParams.toString());
    if (!next) {
      params.delete("sortBy");
      params.delete("sortDir");
    } else {
      params.set("sortBy", next.sortBy);
      params.set("sortDir", next.sortDir);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (!activeOrganizationId) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">{t.organizations.noActiveOrg}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center p-10">
          <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
          <span className="ml-3 text-sm text-ink-muted">{t.organizations.loadingPlaceholder}</span>
        </Card>
      ) : org ? (
        <>
          <OrganizationDetailsCard
            org={org}
            canEdit={canUpdate}
            onEdit={() => setEditOrgOpen(true)}
          />

          <AiUsageCard />

          {canListMembers && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{t.organizations.members}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatMessage(
                      members.length === 1
                        ? t.organizations.memberCount
                        : t.organizations.memberCountPlural,
                      { count: members.length },
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshIconButton onRefresh={fetchMembers} loading={loading} />
                  {canManageInvites && (
                    <Button size="sm" onClick={() => setInviteSheetOpen(true)}>
                      <IconPlus className="h-4 w-4" />
                      {t.organizations.inviteMember}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <MembersTable
                  items={members}
                  loading={false}
                  canManage={canManageMembers}
                  onEdit={handleEditMember}
                  onRemove={handleRemoveMember}
                  sortBy={memberSortBy}
                  sortDir={memberSortDir}
                  onSort={handleMemberSort}
                />
              </div>
            </Card>
          )}

          {canManageInvites && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {t.organizations.pendingInvites}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t.organizations.pendingInvitesSubtitle}
                  </p>
                </div>
                <RefreshIconButton onRefresh={fetchInvites} loading={loading} />
              </div>

              <div className="mt-5">
                <PendingInvitesTable
                  items={invites}
                  loading={false}
                  canManage={canManageInvites}
                  onCopy={handleCopyInviteLink}
                  onRevoke={handleRevokeInvite}
                  copiedId={copiedInviteId}
                />
              </div>
            </Card>
          )}
        </>
      ) : null}

      <OrganizationEditSheet
        open={editOrgOpen}
        org={org}
        onClose={() => setEditOrgOpen(false)}
        onSave={handleSaveOrg}
      />

      {activeOrganizationId && (
        <MemberFormSheet
          open={memberFormOpen}
          member={editingMember}
          organizationId={activeOrganizationId}
          onClose={() => setMemberFormOpen(false)}
          onSave={handleSaveMember}
        />
      )}

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={formatMessage(t.organizations.deleteMemberTitle, {
          name:
            deleteConfirmation.member?.user.fullName ??
            deleteConfirmation.member?.user.email ??
            "",
        })}
        description={t.organizations.deleteMemberDescription}
        confirmText={t.common.delete}
        onConfirm={handleConfirmRemove}
        onCancel={() =>
          setDeleteConfirmation({
            open: false,
            member: null,
            isConfirming: false,
          })
        }
        isConfirming={deleteConfirmation.isConfirming}
      />

      {canManageInvites && activeOrganizationId && (
        <InviteMemberSheet
          open={inviteSheetOpen}
          organizationId={activeOrganizationId}
          onClose={() => setInviteSheetOpen(false)}
          onCreated={fetchInvites}
        />
      )}

      <ConfirmationDialog
        open={revokeConfirmation.open}
        title={formatMessage(t.organizations.revokeInviteTitle, {
          email: revokeConfirmation.invite?.email ?? "",
        })}
        description={t.organizations.revokeInviteDescription}
        confirmText={t.organizations.revoke}
        onConfirm={handleConfirmRevokeInvite}
        onCancel={() =>
          setRevokeConfirmation({
            open: false,
            invite: null,
            isConfirming: false,
          })
        }
        isConfirming={revokeConfirmation.isConfirming}
      />
    </div>
  );
}




