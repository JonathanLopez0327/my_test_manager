"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgRole } from "@/generated/prisma/client";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { IconPlus } from "../icons";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { OrganizationDetailsCard } from "./OrganizationDetailsCard";
import { OrganizationEditSheet } from "./OrganizationEditSheet";
import { MembersTable } from "./MembersTable";
import { MemberFormSheet } from "./MemberFormSheet";
import type {
  MemberRecord,
  MembersResponse,
  OrganizationDetail,
  OrganizationUpdatePayload,
} from "./types";

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Error inesperado (HTTP ${res.status})` };
  }
}

export function OrganizationsPage() {
  const { can, activeOrganizationId } = usePermissions();

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

  const canUpdate = can(PERMISSIONS.ORG_UPDATE);
  const canManageMembers = can(PERMISSIONS.ORG_MEMBER_MANAGE);

  const fetchOrg = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const res = await fetch(`/api/organizations/${activeOrganizationId}`);
      if (!res.ok) throw new Error("No se pudo cargar la organización.");
      const data = (await res.json()) as OrganizationDetail;
      setOrg(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    }
  }, [activeOrganizationId]);

  const fetchMembers = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const res = await fetch(
        `/api/organizations/${activeOrganizationId}/members`,
      );
      if (!res.ok) throw new Error("No se pudieron cargar los miembros.");
      const data = (await res.json()) as MembersResponse;
      setMembers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar miembros.");
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!activeOrganizationId) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchOrg(), fetchMembers()]).finally(() => setLoading(false));
  }, [activeOrganizationId, fetchOrg, fetchMembers]);

  // ── Org update ─────────────────────────────────────────
  const handleSaveOrg = async (payload: OrganizationUpdatePayload) => {
    if (!activeOrganizationId) return;
    const res = await fetch(`/api/organizations/${activeOrganizationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new Error(data.message || "No se pudo actualizar la organización.");
    }
    await fetchOrg();
  };

  // ── Member CRUD ────────────────────────────────────────
  const handleAddMember = () => {
    setEditingMember(null);
    setMemberFormOpen(true);
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
        throw new Error(data.message || "No se pudo actualizar el miembro.");
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
        throw new Error(data.message || "No se pudo agregar el miembro.");
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
        throw new Error(data.message || "No se pudo eliminar el miembro.");
      }
      await Promise.all([fetchOrg(), fetchMembers()]);
      setDeleteConfirmation({ open: false, member: null, isConfirming: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el miembro.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  // ── Guard ──────────────────────────────────────────────
  if (!activeOrganizationId) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          No tienes una organización activa. Selecciona o crea una desde el
          menú lateral.
        </p>
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
          <span className="ml-3 text-sm text-ink-muted">Cargando...</span>
        </Card>
      ) : org ? (
        <>
          <OrganizationDetailsCard
            org={org}
            canEdit={canUpdate}
            onEdit={() => setEditOrgOpen(true)}
          />

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Miembros</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {members.length} miembro{members.length !== 1 ? "s" : ""}
                </p>
              </div>
              {canManageMembers && (
                <Button size="sm" onClick={handleAddMember}>
                  <IconPlus className="h-4 w-4" />
                  Agregar miembro
                </Button>
              )}
            </div>

            <div className="mt-5">
              <MembersTable
                items={members}
                loading={false}
                canManage={canManageMembers}
                onEdit={handleEditMember}
                onRemove={handleRemoveMember}
              />
            </div>
          </Card>
        </>
      ) : null}

      {/* Edit org sheet */}
      <OrganizationEditSheet
        open={editOrgOpen}
        org={org}
        onClose={() => setEditOrgOpen(false)}
        onSave={handleSaveOrg}
      />

      {/* Member form sheet */}
      {activeOrganizationId && (
        <MemberFormSheet
          open={memberFormOpen}
          member={editingMember}
          organizationId={activeOrganizationId}
          onClose={() => setMemberFormOpen(false)}
          onSave={handleSaveMember}
        />
      )}

      {/* Delete member confirmation */}
      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`¿Eliminar a "${deleteConfirmation.member?.user.fullName ?? deleteConfirmation.member?.user.email ?? ""}"?`}
        description="El usuario será removido de la organización. Esta acción no se puede deshacer."
        confirmText="Eliminar"
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
    </div>
  );
}
