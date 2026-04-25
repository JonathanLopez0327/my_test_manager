"use client";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconEdit } from "../icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { OrganizationDetail } from "./types";

type OrganizationDetailsCardProps = {
  org: OrganizationDetail;
  canEdit: boolean;
  onEdit: () => void;
};

export function OrganizationDetailsCard({
  org,
  canEdit,
  onEdit,
}: OrganizationDetailsCardProps) {
  const t = useT();
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{org.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{org.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={org.isActive ? "success" : "neutral"}>
            {org.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <IconEdit className="h-4 w-4" />
              {t.common.edit}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t.organizations.members}
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{org._count.members}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t.organizations.projects}
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{org._count.projects}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t.organizations.created}
          </p>
          <p className="mt-1 text-sm text-ink">
            {new Date(org.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t.organizations.createdBy}
          </p>
          <p className="mt-1 text-sm text-ink">
            {org.createdBy?.fullName ?? org.createdBy?.email ?? "—"}
          </p>
        </div>
      </div>
    </Card>
  );
}
