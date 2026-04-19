"use client";

import { useEffect, useState } from "react";
import type { OrgRole } from "@/generated/prisma/client";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

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

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "billing", label: "Billing" },
];

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
      setError("Email is required.");
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
        throw new Error(data.message || "Could not create the invite.");
      }
      setCreated(data);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the invite.",
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
      title="Invite member"
      description={
        created
          ? "Share the link below with the invited user. They can sign in or create an account."
          : "We'll generate a one-time link you can share with the invitee."
      }
      onClose={onClose}
    >
      <div className="grid gap-4">
        {created ? (
          <>
            <div className="rounded-lg border border-stroke bg-surface-muted p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Invitee
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {created.email}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Role: {created.role}
              </p>
            </div>

            <label className="text-sm font-semibold text-ink">
              Invite link
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 flex-1 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-xs text-ink"
                />
                <Button variant="secondary" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </label>

            <p className="text-xs text-ink-muted">
              This link expires on{" "}
              {new Date(created.expiresAt).toLocaleDateString()}. Only the
              invited email address can use it.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <Input
              type="email"
              label="Email *"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />

            <label className="text-sm font-semibold text-ink">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
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
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create invite"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
