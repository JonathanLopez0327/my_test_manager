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
  IconReset,
  IconX,
} from "../icons";
import { RefreshIconButton } from "../ui/RefreshIconButton";
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
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Unexpected error (HTTP ${res.status})` };
  }
}

export function SuperAdminOrganizationsView() {
  const t = useT();
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

  // Reset AI usage
  const [resetUsageTarget, setResetUsageTarget] = useState<OrganizationRecord | null>(null);
  const [resettingUsage, setResettingUsage] = useState(false);

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
      if (!res.ok) throw new Error(t.superAdminOrgs.errors.couldNotLoad);
      const data = (await res.json()) as OrganizationsResponse;
      setOrgs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.superAdminOrgs.errors.errorLoading);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDir, t]);

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
        throw new Error(data.message || t.superAdminOrgs.errors.couldNotUpdate);
      }
      await fetchOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.superAdminOrgs.errors.errorUpdating);
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
      throw new Error(data.message || t.superAdminOrgs.errors.couldNotUpdate);
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
            (licenseAction.type === "suspend"
              ? t.superAdminOrgs.errors.couldNotSuspend
              : t.superAdminOrgs.errors.couldNotReinstate),
        );
      }
      await fetchOrgs();
      setLicenseAction(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.superAdminOrgs.errors.errorUpdatingLicense,
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
        throw new Error(data.message || t.superAdminOrgs.errors.couldNotRenew);
      }
      await fetchOrgs();
      setRenewTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.superAdminOrgs.errors.errorRenewing);
    } finally {
      setRenewing(false);
    }
  };

  const handleConfirmResetUsage = async () => {
    if (!resetUsageTarget) return;
    setResettingUsage(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/organizations/${resetUsageTarget.id}/reset-ai-usage`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.superAdminOrgs.errors.couldNotResetUsage);
      }
      await fetchOrgs();
      setResetUsageTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.superAdminOrgs.errors.errorResettingUsage,
      );
    } finally {
      setResettingUsage(false);
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
              {t.superAdminOrgs.eyebrow}
            </p>
            <h2 className="text-2xl font-semibold text-ink">{t.superAdminOrgs.heading}</h2>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:w-auto">
            <RefreshIconButton onRefresh={fetchOrgs} loading={loading} />
            <Button
              onClick={() => setCreateOrgOpen(true)}
              size="sm"
              className="whitespace-nowrap"
            >
              <IconPlus className="h-4 w-4" />
              {t.superAdminOrgs.newOrg}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              {t.superAdminOrgs.listTitle}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? t.superAdminOrgs.updating : `${t.superAdminOrgs.totalLabel}: ${orgs.length}`}
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
        emptyTitle={t.superAdminOrgs.emptyTitle}
        emptyDescription={t.superAdminOrgs.emptyDescription}
        desktop={
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
              <tr className="text-left text-[13px] font-medium text-ink-soft">
                <SortableHeaderCell
                  label={t.superAdminOrgs.columns.name}
                  sortKey="name"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label={t.superAdminOrgs.columns.slug}
                  sortKey="slug"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label={t.superAdminOrgs.columns.members}
                  sortKey="members"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label={t.superAdminOrgs.columns.projects}
                  sortKey="projects"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <th
                  className="px-3 py-2"
                  title={t.superAdminOrgs.usage.aiTokensTitle}
                >
                  {t.superAdminOrgs.columns.aiTokens}
                </th>
                <th
                  className="px-3 py-2"
                  title={t.superAdminOrgs.usage.storageTitle}
                >
                  {t.superAdminOrgs.columns.storage}
                </th>
                <SortableHeaderCell
                  label={t.superAdminOrgs.columns.status}
                  sortKey="isActive"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-3 py-2">{t.superAdminOrgs.columns.license}</th>
                <th className="px-3 py-2 text-right">{t.superAdminOrgs.columns.actions}</th>
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
                    <UsageBarCell
                      used={org.aiTokensUsed}
                      limit={org.aiTokenLimitMonthly}
                      format="number"
                      noLimitLabel={t.superAdminOrgs.usage.noLimit}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <UsageBarCell
                      used={org.storageUsedBytes}
                      limit={org.maxArtifactBytes}
                      format="bytes"
                      noLimitLabel={t.superAdminOrgs.usage.noLimit}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={org.isActive ? "success" : "neutral"}>
                      {org.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {renderLicenseCell(org.betaExpiresAt, t)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <RowActionButton
                        onClick={() => handleEditClick(org)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label={t.superAdminOrgs.actions.editOrg}
                        title={t.superAdminOrgs.actions.editOrg}
                      />
                      <RowActionButton
                        onClick={() => setRenewTarget(org)}
                        icon={<IconRefresh className="h-4 w-4" />}
                        label={t.superAdminOrgs.actions.renewLicense}
                        title={t.superAdminOrgs.actions.renewLicenseTitle}
                      />
                      <RowActionButton
                        onClick={() => setResetUsageTarget(org)}
                        icon={<IconReset className="h-4 w-4" />}
                        label={t.superAdminOrgs.actions.resetAiUsage}
                        title={t.superAdminOrgs.actions.resetAiUsageTitle}
                        tone="danger"
                      />
                      {isLicenseSuspended(org.betaExpiresAt) ? (
                        <RowActionButton
                          onClick={() =>
                            setLicenseAction({ type: "reinstate", org })
                          }
                          icon={<IconCheck className="h-4 w-4" />}
                          label={t.superAdminOrgs.actions.reinstateLicense}
                          title={t.superAdminOrgs.actions.reinstateLicenseTitle}
                        />
                      ) : (
                        <RowActionButton
                          onClick={() =>
                            setLicenseAction({ type: "suspend", org })
                          }
                          icon={<IconAlert className="h-4 w-4" />}
                          label={t.superAdminOrgs.actions.suspendLicense}
                          title={t.superAdminOrgs.actions.suspendLicenseTitle}
                          tone="danger"
                        />
                      )}
                      {org.isActive ? (
                        <RowActionButton
                          onClick={() => handleToggleActive(org)}
                          icon={<IconX className="h-4 w-4" />}
                          label={t.superAdminOrgs.actions.deactivateOrg}
                          title={t.superAdminOrgs.actions.deactivateOrg}
                          tone="danger"
                        />
                      ) : (
                        <RowActionButton
                          onClick={() => handleToggleActive(org)}
                          icon={<IconCheck className="h-4 w-4" />}
                          label={t.superAdminOrgs.actions.activateOrg}
                          title={t.superAdminOrgs.actions.activateOrg}
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
                    {org.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-muted">
                  <div>{t.superAdminOrgs.mobile.members}: {org._count.members}</div>
                  <div>{t.superAdminOrgs.mobile.projects}: {org._count.projects}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                      {t.superAdminOrgs.mobile.aiTokens}
                    </p>
                    <UsageBarCell
                      used={org.aiTokensUsed}
                      limit={org.aiTokenLimitMonthly}
                      format="number"
                      noLimitLabel={t.superAdminOrgs.usage.noLimit}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                      {t.superAdminOrgs.mobile.storage}
                    </p>
                    <UsageBarCell
                      used={org.storageUsedBytes}
                      limit={org.maxArtifactBytes}
                      format="bytes"
                      noLimitLabel={t.superAdminOrgs.usage.noLimit}
                    />
                  </div>
                </div>
                <div className="mt-3">{renderLicenseCell(org.betaExpiresAt, t)}</div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <RowActionButton
                    onClick={() => handleEditClick(org)}
                    icon={<IconEdit className="h-4 w-4" />}
                    label={t.superAdminOrgs.actions.editOrg}
                    title={t.superAdminOrgs.actions.editOrg}
                  />
                  <RowActionButton
                    onClick={() => setRenewTarget(org)}
                    icon={<IconRefresh className="h-4 w-4" />}
                    label={t.superAdminOrgs.actions.renewLicense}
                    title={t.superAdminOrgs.actions.renewLicenseTitle}
                  />
                  <RowActionButton
                    onClick={() => setResetUsageTarget(org)}
                    icon={<IconReset className="h-4 w-4" />}
                    label={t.superAdminOrgs.actions.resetAiUsage}
                    title={t.superAdminOrgs.actions.resetAiUsageTitle}
                    tone="danger"
                  />
                  {isLicenseSuspended(org.betaExpiresAt) ? (
                    <RowActionButton
                      onClick={() =>
                        setLicenseAction({ type: "reinstate", org })
                      }
                      icon={<IconCheck className="h-4 w-4" />}
                      label={t.superAdminOrgs.actions.reinstateLicense}
                      title={t.superAdminOrgs.actions.reinstateLicenseTitle}
                    />
                  ) : (
                    <RowActionButton
                      onClick={() =>
                        setLicenseAction({ type: "suspend", org })
                      }
                      icon={<IconAlert className="h-4 w-4" />}
                      label={t.superAdminOrgs.actions.suspendLicense}
                      title={t.superAdminOrgs.actions.suspendLicenseTitle}
                      tone="danger"
                    />
                  )}
                  {org.isActive ? (
                    <RowActionButton
                      onClick={() => handleToggleActive(org)}
                      icon={<IconX className="h-4 w-4" />}
                      label={t.superAdminOrgs.actions.deactivateOrg}
                      title={t.superAdminOrgs.actions.deactivateOrg}
                      tone="danger"
                    />
                  ) : (
                    <RowActionButton
                      onClick={() => handleToggleActive(org)}
                      icon={<IconCheck className="h-4 w-4" />}
                      label={t.superAdminOrgs.actions.activateOrg}
                      title={t.superAdminOrgs.actions.activateOrg}
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
        title={formatMessage(t.superAdminOrgs.renewDialog.title, { name: renewTarget?.name ?? "" })}
        description={t.superAdminOrgs.renewDialog.description}
        confirmText={t.superAdminOrgs.renewDialog.confirm}
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
            ? formatMessage(t.superAdminOrgs.suspendDialog.title, { name: licenseAction.org.name })
            : formatMessage(t.superAdminOrgs.reinstateDialog.title, { name: licenseAction?.org.name ?? "" })
        }
        description={
          licenseAction?.type === "suspend"
            ? t.superAdminOrgs.suspendDialog.description
            : t.superAdminOrgs.reinstateDialog.description
        }
        confirmText={
          licenseAction?.type === "suspend"
            ? t.superAdminOrgs.suspendDialog.confirm
            : t.superAdminOrgs.reinstateDialog.confirm
        }
        variant={licenseAction?.type === "suspend" ? "danger" : "info"}
        onConfirm={handleConfirmLicenseAction}
        onCancel={() => {
          if (licenseActionRunning) return;
          setLicenseAction(null);
        }}
        isConfirming={licenseActionRunning}
      />

      <ConfirmationDialog
        open={!!resetUsageTarget}
        title={formatMessage(t.superAdminOrgs.resetUsageDialog.title, {
          name: resetUsageTarget?.name ?? "",
        })}
        description={t.superAdminOrgs.resetUsageDialog.description}
        confirmText={t.superAdminOrgs.resetUsageDialog.confirm}
        variant="danger"
        onConfirm={handleConfirmResetUsage}
        onCancel={() => {
          if (resettingUsage) return;
          setResetUsageTarget(null);
        }}
        isConfirming={resettingUsage}
      />
    </div>
  );
}

function isLicenseSuspended(betaExpiresAt: string | null): boolean {
  if (!betaExpiresAt) return false;
  return new Date(betaExpiresAt).getTime() <= 0;
}

function formatNumberCompact(n: bigint): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatBytes(n: bigint): string {
  const num = Number(n);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type UsageBarCellProps = {
  used: string | undefined;
  limit: string | number | undefined;
  format: "number" | "bytes";
  noLimitLabel: string;
};

function UsageBarCell({ used, limit, format, noLimitLabel }: UsageBarCellProps) {
  if (used === undefined || limit === undefined) {
    return <span className="text-xs text-ink-muted">{noLimitLabel}</span>;
  }
  const usedBig = BigInt(used);
  const limitBig = typeof limit === "number" ? BigInt(limit) : BigInt(limit);

  if (limitBig <= BigInt(0)) {
    return <span className="text-xs text-ink-muted">{noLimitLabel}</span>;
  }

  const pct = Math.min(100, Number((usedBig * BigInt(100)) / limitBig));
  const barColor =
    pct >= 100 ? "bg-danger-500" : pct >= 80 ? "bg-warning-500" : "bg-brand-500";
  const fmt = format === "bytes" ? formatBytes : formatNumberCompact;

  return (
    <div className="min-w-[6.5rem]">
      <p className="text-[11px] tabular-nums text-ink-muted">
        <span className="font-medium text-ink">{fmt(usedBig)}</span>
        <span> / {fmt(limitBig)}</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function renderLicenseCell(betaExpiresAt: string | null, t: Messages) {
  if (!betaExpiresAt) {
    return <span className="text-xs text-ink-muted">{t.superAdminOrgs.license.none}</span>;
  }
  const expiresAt = new Date(betaExpiresAt);
  const expiresMs = expiresAt.getTime();

  if (expiresMs <= 0) {
    return <Badge tone="danger">{t.superAdminOrgs.license.suspended}</Badge>;
  }

  const now = Date.now();
  const diffMs = expiresMs - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return <Badge tone="danger">{t.superAdminOrgs.license.expired}</Badge>;
  }
  if (diffDays <= 7) {
    return <Badge tone="warning">{formatMessage(t.superAdminOrgs.license.expiresInDays, { days: diffDays })}</Badge>;
  }
  return (
    <span className="text-xs text-ink-muted">
      {expiresAt.toLocaleDateString()}
    </span>
  );
}
