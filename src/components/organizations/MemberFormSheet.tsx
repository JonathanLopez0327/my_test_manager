"use client";

import { useEffect, useState } from "react";
import type { OrgRole } from "@/generated/prisma/client";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MemberRecord } from "./types";

type UserOption = {
  id: string;
  email: string;
  fullName: string | null;
};

type MemberFormSheetProps = {
  open: boolean;
  member: MemberRecord | null;
  organizationId: string;
  onClose: () => void;
  onSave: (userId: string, role: OrgRole, isEdit: boolean) => Promise<void>;
};

const ROLE_ORDER: OrgRole[] = ["owner", "admin", "member", "billing"];

export function MemberFormSheet({
  open,
  member,
  organizationId,
  onClose,
  onSave,
}: MemberFormSheetProps) {
  const t = useT();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<OrgRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(member);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (member) {
      setSelectedUserId(member.userId);
      setSelectedRole(member.role);
    } else {
      setSelectedUserId("");
      setSelectedRole("member");
      fetch(`/api/users?pageSize=50&organizationId=${organizationId}`)
        .then((res) => res.json())
        .then((data: { items?: UserOption[] }) => {
          setUsers(data.items ?? []);
          if (data.items?.length) {
            setSelectedUserId(data.items[0].id);
          }
        })
        .catch(() => {});
    }
  }, [open, member, organizationId]);

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSave(selectedUserId, selectedRole, isEdit);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.organizations.memberForm.couldNotSave,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={isEdit ? t.organizations.memberForm.titleEdit : t.organizations.memberForm.titleAdd}
      description={
        isEdit
          ? t.organizations.memberForm.descriptionEdit
          : t.organizations.memberForm.descriptionAdd
      }
      onClose={onClose}
    >
      <div className="grid gap-4">
        {isEdit && member ? (
          <div className="rounded-lg border border-stroke bg-surface-muted p-4">
            <p className="text-sm font-semibold text-ink">
              {member.user.fullName ?? t.organizations.memberForm.unnamedFallback}
            </p>
            <p className="text-xs text-ink-muted">{member.user.email}</p>
          </div>
        ) : (
          <label className="text-sm font-semibold text-ink">
            {t.organizations.memberForm.userLabel}
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                  {u.fullName ? ` — ${u.fullName}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm font-semibold text-ink">
          {t.organizations.memberForm.roleLabel}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          >
            {ROLE_ORDER.map((value) => (
              <option key={value} value={value}>
                {t.organizations.roles[value]}
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
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedUserId}
          >
            {submitting
              ? t.organizations.memberForm.saving
              : isEdit
                ? t.organizations.memberForm.saveChanges
                : t.organizations.memberForm.addMember}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
