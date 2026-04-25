"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";

type AcceptInviteButtonProps = {
  token: string;
};

export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const router = useRouter();
  const { update } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        organizationId?: string;
        organizationSlug?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message || "Could not accept the invite.");
      }

      if (data.organizationId) {
        await fetch("/api/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: data.organizationId }),
        }).catch(() => undefined);

        await update({ activeOrganizationId: data.organizationId });
      }

      router.push("/manager");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not accept the invite.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="h-11 rounded-xl text-base"
        onClick={handleAccept}
        disabled={submitting}
      >
        {submitting ? "Accepting..." : "Accept invite"}
      </Button>
      {error ? (
        <p className="text-xs font-semibold text-danger-500" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
