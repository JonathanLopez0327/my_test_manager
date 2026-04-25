"use client";

import { useEffect, useState } from "react";
import type { OrgRole } from "@/generated/prisma/client";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";

type InviteMemberSheetProps = {
  open: boolean;
  organizationId: string;
  onClose: () => void;
  onCreated: () => void;
};

type CreatedInvite = {
  id: string;
  token: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
};

const ROLE_ORDER: OrgRole[] = ["admin", "member", "billing"];

function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export function InviteMemberSheet({
  open,
  organizationId,
  onClose,
  onCreated,
}: InviteMemberSheetProps) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("member");
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t.organizations.inviteForm.emailRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = (await res.json()) as CreatedInvite & { message?: string };
      if (!res.ok) {
        throw new Error(data.message || t.organizations.inviteForm.couldNotCreate);
      }
      setCreated(data);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.organizations.inviteForm.couldNotCreate,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    const url = buildInviteUrl(created.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const inviteUrl = created ? buildInviteUrl(created.token) : "";

  return (
    <Sheet
      open={open}
      title={t.organizations.inviteForm.title}
      description={
        created
          ? t.organizations.inviteForm.descriptionCreated
          : t.organizations.inviteForm.descriptionNew
      }
      onClose={onClose}
    >
      <div className="grid gap-4">
        {created ? (
          <>
            <div className="rounded-lg border border-stroke bg-surface-muted p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {t.organizations.inviteForm.inviteeLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {created.email}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t.organizations.inviteForm.rolePrefix}: {t.organizations.roles[created.role]}
              </p>
            </div>

            <label className="text-sm font-semibold text-ink">
              {t.organizations.inviteForm.inviteLinkLabel}
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 flex-1 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-xs text-ink"
                />
                <Button variant="secondary" onClick={handleCopy}>
                  {copied ? t.organizations.inviteForm.copied : t.organizations.inviteForm.copy}
                </Button>
              </div>
            </label>

            <p className="text-xs text-ink-muted">
              {formatMessage(t.organizations.inviteForm.expiresOnNote, {
                date: new Date(created.expiresAt).toLocaleDateString(),
              })}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button onClick={onClose}>{t.organizations.inviteForm.done}</Button>
            </div>
          </>
        ) : (
          <>
            <Input
              type="email"
              label={t.organizations.inviteForm.emailLabel}
              placeholder={t.organizations.inviteForm.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />

            <label className="text-sm font-semibold text-ink">
              {t.organizations.inviteForm.roleLabel}
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
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
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? t.organizations.inviteForm.creating
                  : t.organizations.inviteForm.createInvite}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
