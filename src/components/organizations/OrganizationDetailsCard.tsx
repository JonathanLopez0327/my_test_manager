"use client";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconEdit } from "../icons";
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
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{org.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{org.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={org.isActive ? "success" : "neutral"}>
            {org.isActive ? "Active" : "Inactive"}
          </Badge>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <IconEdit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Members
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{org._count.members}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Projects
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{org._count.projects}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Created
          </p>
          <p className="mt-1 text-sm text-ink">
            {new Date(org.createdAt).toLocaleDateString("en-US")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Created by
          </p>
          <p className="mt-1 text-sm text-ink">
            {org.createdBy?.fullName ?? org.createdBy?.email ?? "—"}
          </p>
        </div>
      </div>
    </Card>
  );
}
