"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { MemberRole } from "@/generated/prisma/client";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { Sheet } from "../ui/Sheet";
import { IconEdit, IconPlus, IconTrash } from "../icons";
import { useCan } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";

type ProjectMemberRecord = {
  projectId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  user: { id: string; fullName: string | null; email: string };
};

type OrgMemberRecord = {
  userId: string;
  user: { id: string; fullName: string | null; email: string };
};

type ProjectMembersTabProps = {
  projectId: string;
  organizationId: string;
};

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABELS: Record<MemberRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};

const ROLE_TONES: Record<MemberRole, "warning" | "success" | "neutral"> = {
  admin: "warning",
  editor: "success",
  viewer: "neutral",
};

export function ProjectMembersTab({ projectId, organizationId }: ProjectMembersTabProps) {
  const canManage = useCan(PERMISSIONS.PROJECT_MEMBER_MANAGE);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [members, setMembers] = useState<ProjectMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectMemberRecord | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    member: ProjectMemberRecord;
    submitting: boolean;
  } | null>(null);

  const existingUserIds = useMemo(
    () => members.map((m) => m.userId),
    [members],
  );

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) {
        throw new Error("Could not load project members.");
      }
      const data = (await res.json()) as { items: ProjectMemberRecord[] };
      setMembers(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setConfirmRemove((prev) => (prev ? { ...prev, submitting: true } : prev));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${confirmRemove.member.userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Could not remove the member.");
      }
      setConfirmRemove(null);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
      setConfirmRemove((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Project members</p>
          <p className="mt-1 text-xs text-ink-muted">
            {members.length} member{members.length !== 1 ? "s" : ""} with access to this project.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <IconPlus className="h-4 w-4" />
            Add member
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-surface-elevated">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-ink-muted">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
            No members yet.
            {canManage && (
              <span className="text-xs">
                Click &quot;Add member&quot; to grant access.
              </span>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stroke text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-b border-stroke/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      {member.user.fullName ?? member.user.email}
                    </div>
                    {member.user.fullName && (
                      <div className="text-xs text-ink-muted">{member.user.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {member.userId === currentUserId ? (
                        <span className="text-xs text-ink-muted">You</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink"
                            onClick={() => { setEditing(member); setFormOpen(true); }}
                            aria-label="Edit role"
                          >
                            <IconEdit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted hover:bg-danger-500/10 hover:text-danger-500"
                            onClick={() => setConfirmRemove({ member, submitting: false })}
                            aria-label="Remove member"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <ProjectMemberFormSheet
          open={formOpen}
          projectId={projectId}
          organizationId={organizationId}
          member={editing}
          existingUserIds={existingUserIds}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await fetchMembers();
          }}
        />
      )}

      {confirmRemove && (
        <ConfirmationDialog
          open={Boolean(confirmRemove)}
          title="Remove project member"
          description={`Remove ${confirmRemove.member.user.fullName ?? confirmRemove.member.user.email} from this project?`}
          confirmText="Remove"
          variant="danger"
          isConfirming={confirmRemove.submitting}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

type ProjectMemberFormSheetProps = {
  open: boolean;
  projectId: string;
  organizationId: string;
  member: ProjectMemberRecord | null;
  existingUserIds: string[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

function ProjectMemberFormSheet({
  open,
  projectId,
  organizationId,
  member,
  existingUserIds,
  onClose,
  onSaved,
}: ProjectMemberFormSheetProps) {
  const isEdit = Boolean(member);
  const [orgMembers, setOrgMembers] = useState<OrgMemberRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (member) {
      setSelectedUserId(member.userId);
      setSelectedRole(member.role);
      return;
    }
    setSelectedUserId("");
    setSelectedRole("viewer");
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/members`);
        if (!res.ok) throw new Error("Could not load organization members.");
        const data = (await res.json()) as { items?: OrgMemberRecord[] };
        const available = (data.items ?? []).filter(
          (m) => !existingUserIds.includes(m.userId),
        );
        setOrgMembers(available);
        if (available.length > 0) {
          setSelectedUserId(available[0].userId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      }
    })();
  }, [open, member, organizationId, existingUserIds]);

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/projects/${projectId}/members/${selectedUserId}`
        : `/api/projects/${projectId}/members`;
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { role: selectedRole }
        : { userId: selectedUserId, role: selectedRole };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Could not save the member.");
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={isEdit ? "Edit project role" : "Add project member"}
      description={
        isEdit
          ? "Change this member's role in the project."
          : "Grant an organization member access to this project."
      }
      onClose={onClose}
    >
      <div className="grid gap-4">
        {isEdit && member ? (
          <div className="rounded-lg border border-stroke bg-surface-muted p-4">
            <p className="text-sm font-semibold text-ink">
              {member.user.fullName ?? "Unnamed"}
            </p>
            <p className="text-xs text-ink-muted">{member.user.email}</p>
          </div>
        ) : (
          <label className="text-sm font-semibold text-ink">
            User
            {orgMembers.length === 0 ? (
              <p className="mt-2 rounded-lg border border-stroke bg-surface-muted px-3 py-2 text-xs font-normal text-ink-muted">
                All organization members already have access to this project.
              </p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              >
                {orgMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.email}
                    {m.user.fullName ? ` — ${m.user.fullName}` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        <label className="text-sm font-semibold text-ink">
          Role
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedUserId}
          >
            {submitting
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Add member"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
