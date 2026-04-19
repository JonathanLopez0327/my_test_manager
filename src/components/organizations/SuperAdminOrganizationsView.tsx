"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import {
  IconAlert,
  IconCheck,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconX,
} from "../icons";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { OrganizationEditSheet } from "./OrganizationEditSheet";
import { OrganizationCreateSheet } from "./OrganizationCreateSheet";
import type {
  OrganizationRecord,
  OrganizationUpdatePayload,
  OrganizationsResponse,
  OrganizationSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Unexpected error (HTTP ${res.status})` };
  }
}

export function SuperAdminOrganizationsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit sheet
  const [editOrg, setEditOrg] = useState<OrganizationRecord | null>(null);
  const [editOrgOpen, setEditOrgOpen] = useState(false);

  // Create sheet
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  // Renew license
  const [renewTarget, setRenewTarget] = useState<OrganizationRecord | null>(null);
  const [renewing, setRenewing] = useState(false);

  // Suspend / Reinstate license
  const [licenseAction, setLicenseAction] = useState<
    | { type: "suspend" | "reinstate"; org: OrganizationRecord }
    | null
  >(null);
  const [licenseActionRunning, setLicenseActionRunning] = useState(false);

  const sortBy = (searchParams.get("sortBy") as OrganizationSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
      const res = await fetch(`/api/organizations${params.toString() ? `?${params.toString()}` : ""}`);
      if (!res.ok) throw new Error("Could not cargar las organizations.");
      const data = (await res.json()) as OrganizationsResponse;
      setOrgs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data.");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleToggleActive = async (org: OrganizationRecord) => {
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || "Could not update the organization.");
      }
      await fetchOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating data.");
    }
  };

  const handleEditClick = (org: OrganizationRecord) => {
    setEditOrg(org);
    setEditOrgOpen(true);
  };

  const handleSaveOrg = async (payload: OrganizationUpdatePayload) => {
    if (!editOrg) return;
    const res = await fetch(`/api/organizations/${editOrg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new Error(data.message || "Could not update the organization.");
    }
    await fetchOrgs();
  };

  const handleOrgCreated = async () => {
    await fetchOrgs();
  };

  const handleConfirmLicenseAction = async () => {
    if (!licenseAction) return;
    setLicenseActionRunning(true);
    setError(null);
    try {
      const path =
        licenseAction.type === "suspend"
          ? `/api/admin/organizations/${licenseAction.org.id}/suspend-license`
          : `/api/admin/organizations/${licenseAction.org.id}/reinstate-license`;
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(
          data.message ??
            `Could not ${licenseAction.type} the license.`,
        );
      }
      await fetchOrgs();
      setLicenseAction(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error updating license.",
      );
    } finally {
      setLicenseActionRunning(false);
    }
  };

  const handleConfirmRenew = async () => {
    if (!renewTarget) return;
    setRenewing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/organizations/${renewTarget.id}/renew-license`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || "Could not renew the license.");
      }
      await fetchOrgs();
      setRenewTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error renewing license.");
    } finally {
      setRenewing(false);
    }
  };

  const handleSort = (column: OrganizationSortBy) => {
    const next = nextSort<OrganizationSortBy>(sortBy, sortDir, column);
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Organization management
            </p>
            <h2 className="text-2xl font-semibold text-ink">Organizations</h2>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:w-auto">
            <Button
              onClick={() => setCreateOrgOpen(true)}
              size="sm"
              className="whitespace-nowrap"
            >
              <IconPlus className="h-4 w-4" />
              New organization
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              Organizations list
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? "Updating..." : `Total: ${orgs.length}`}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <TableShell
        loading={loading}
        hasItems={orgs.length > 0}
        emptyTitle="No organizations registered."
        emptyDescription="Create a new organization to get started."
        desktop={
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
              <tr className="text-left text-[13px] font-medium text-ink-soft">
                <SortableHeaderCell
                  label="Name"
                  sortKey="name"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Slug"
                  sortKey="slug"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Members"
                  sortKey="members"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Projects"
                  sortKey="projects"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Status"
                  sortKey="isActive"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-3 py-2">License</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="transition-colors hover:bg-brand-50/35"
                >
                  <td className="px-3 py-2.5 font-semibold text-ink">
                    {org.name}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">{org.slug}</td>
                  <td className="px-3 py-2.5 text-ink-muted">
                    {org._count.members}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">
                    {org._count.projects}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={org.isActive ? "success" : "neutral"}>
                      {org.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {renderLicenseCell(org.betaExpiresAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <RowActionButton
                        onClick={() => handleEditClick(org)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label="Edit organization"
                        title="Edit organization"
                      />
                      <RowActionButton
                        onClick={() => setRenewTarget(org)}
                        icon={<IconRefresh className="h-4 w-4" />}
                        label="Renew license"
                        title="Renew license via Keygen"
                      />
                      {isLicenseSuspended(org.betaExpiresAt) ? (
                        <RowActionButton
                          onClick={() =>
                            setLicenseAction({ type: "reinstate", org })
                          }
                          icon={<IconCheck className="h-4 w-4" />}
                          label="Reinstate license"
                          title="Reinstate license in Keygen"
                        />
                      ) : (
                        <RowActionButton
                          onClick={() =>
                            setLicenseAction({ type: "suspend", org })
                          }
                          icon={<IconAlert className="h-4 w-4" />}
                          label="Suspend license"
                          title="Suspend license in Keygen"
                          tone="danger"
                        />
                      )}
                      {org.isActive ? (
                        <RowActionButton
                          onClick={() => handleToggleActive(org)}
                          icon={<IconX className="h-4 w-4" />}
                          label="Deactivate organization"
                          title="Deactivate organization"
                          tone="danger"
                        />
                      ) : (
                        <RowActionButton
                          onClick={() => handleToggleActive(org)}
                          icon={<IconCheck className="h-4 w-4" />}
                          label="Activate organization"
                          title="Activate organization"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        mobile={
          <>
            {orgs.map((org) => (
              <div
                key={org.id}
                className="rounded-lg bg-surface-elevated p-5 shadow-sm dark:bg-surface-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {org.name}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{org.slug}</p>
                  </div>
                  <Badge tone={org.isActive ? "success" : "neutral"}>
                    {org.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-muted">
                  <div>Members: {org._count.members}</div>
                  <div>Projects: {org._count.projects}</div>
                </div>
                <div className="mt-3">{renderLicenseCell(org.betaExpiresAt)}</div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <RowActionButton
                    onClick={() => handleEditClick(org)}
                    icon={<IconEdit className="h-4 w-4" />}
                    label="Edit organization"
                    title="Edit organization"
                  />
                  <RowActionButton
                    onClick={() => setRenewTarget(org)}
                    icon={<IconRefresh className="h-4 w-4" />}
                    label="Renew license"
                    title="Renew license via Keygen"
                  />
                  {isLicenseSuspended(org.betaExpiresAt) ? (
                    <RowActionButton
                      onClick={() =>
                        setLicenseAction({ type: "reinstate", org })
                      }
                      icon={<IconCheck className="h-4 w-4" />}
                      label="Reinstate license"
                      title="Reinstate license in Keygen"
                    />
                  ) : (
                    <RowActionButton
                      onClick={() =>
                        setLicenseAction({ type: "suspend", org })
                      }
                      icon={<IconAlert className="h-4 w-4" />}
                      label="Suspend license"
                      title="Suspend license in Keygen"
                      tone="danger"
                    />
                  )}
                  {org.isActive ? (
                    <RowActionButton
                      onClick={() => handleToggleActive(org)}
                      icon={<IconX className="h-4 w-4" />}
                      label="Deactivate organization"
                      title="Deactivate organization"
                      tone="danger"
                    />
                  ) : (
                    <RowActionButton
                      onClick={() => handleToggleActive(org)}
                      icon={<IconCheck className="h-4 w-4" />}
                      label="Activate organization"
                      title="Activate organization"
                    />
                  )}
                </div>
              </div>
            ))}
          </>
        }
          />
        </div>
      </Card>

      <OrganizationEditSheet
        open={editOrgOpen}
        org={editOrg ? { ...editOrg, createdBy: null } : null}
        onClose={() => {
          setEditOrgOpen(false);
          setEditOrg(null);
        }}
        onSave={handleSaveOrg}
        showQuotas={true}
      />

      <OrganizationCreateSheet
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreated={handleOrgCreated}
      />

      <ConfirmationDialog
        open={!!renewTarget}
        title={`Renew license for "${renewTarget?.name ?? ""}"?`}
        description="This will call Keygen to extend the organization's license expiry based on the current policy, and refresh cached quotas. Continue?"
        confirmText="Renew"
        variant="info"
        onConfirm={handleConfirmRenew}
        onCancel={() => {
          if (renewing) return;
          setRenewTarget(null);
        }}
        isConfirming={renewing}
      />

      <ConfirmationDialog
        open={!!licenseAction}
        title={
          licenseAction?.type === "suspend"
            ? `Suspend license for "${licenseAction.org.name}"?`
            : `Reinstate license for "${licenseAction?.org.name ?? ""}"?`
        }
        description={
          licenseAction?.type === "suspend"
            ? "All write actions will be blocked immediately for members of this organization until the license is reinstated."
            : "The license will be reactivated in Keygen and write actions will be re-enabled. The expiry will be restored to Keygen's current value."
        }
        confirmText={licenseAction?.type === "suspend" ? "Suspend" : "Reinstate"}
        variant={licenseAction?.type === "suspend" ? "danger" : "info"}
        onConfirm={handleConfirmLicenseAction}
        onCancel={() => {
          if (licenseActionRunning) return;
          setLicenseAction(null);
        }}
        isConfirming={licenseActionRunning}
      />
    </div>
  );
}

function isLicenseSuspended(betaExpiresAt: string | null): boolean {
  if (!betaExpiresAt) return false;
  return new Date(betaExpiresAt).getTime() <= 0;
}

function renderLicenseCell(betaExpiresAt: string | null) {
  if (!betaExpiresAt) {
    return <span className="text-xs text-ink-muted">No license</span>;
  }
  const expiresAt = new Date(betaExpiresAt);
  const expiresMs = expiresAt.getTime();

  if (expiresMs <= 0) {
    return <Badge tone="danger">Suspended</Badge>;
  }

  const now = Date.now();
  const diffMs = expiresMs - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return <Badge tone="danger">Expired</Badge>;
  }
  if (diffDays <= 7) {
    return <Badge tone="warning">Expires in {diffDays}d</Badge>;
  }
  return (
    <span className="text-xs text-ink-muted">
      {expiresAt.toLocaleDateString()}
    </span>
  );
}



