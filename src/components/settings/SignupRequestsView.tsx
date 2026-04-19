"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { Input } from "../ui/Input";
import { RowActionButton } from "../ui/RowActionButton";
import { TableShell } from "../ui/TableShell";
import { IconCheck, IconX } from "../icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";

type SignupRequestProvider = "credentials" | "google";
type SignupRequestStatus = "pending" | "approved" | "rejected";

type SignupRequestRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationSlug: string | null;
  provider: SignupRequestProvider;
  status: SignupRequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
};

type SignupRequestsResponse = { items: SignupRequestRecord[] };

type StatusFilter = SignupRequestStatus | "all";

const STATUS_FILTER_IDS: StatusFilter[] = ["pending", "approved", "rejected", "all"];

const POLL_INTERVAL_MS = 20_000;

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Unexpected error (HTTP ${res.status})` };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function statusBadge(status: SignupRequestStatus, t: Messages) {
  switch (status) {
    case "pending":
      return <Badge tone="warning">{t.signupRequests.status.pending}</Badge>;
    case "approved":
      return <Badge tone="success">{t.signupRequests.status.approved}</Badge>;
    case "rejected":
      return <Badge tone="danger">{t.signupRequests.status.rejected}</Badge>;
  }
}

export function SignupRequestsView() {
  const t = useT();
  const [items, setItems] = useState<SignupRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const [approveTarget, setApproveTarget] = useState<SignupRequestRecord | null>(null);
  const [approving, setApproving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<SignupRequestRecord | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const fetchItems = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(`/api/admin/signup-requests?status=${statusFilter}`);
        if (!res.ok) {
          const data = await safeJson(res);
          throw new Error(data.message || t.signupRequests.errors.couldNotLoad);
        }
        const data = (await res.json()) as SignupRequestsResponse;
        setItems(data.items);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : t.signupRequests.errors.loading);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter, t],
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = approving || rejecting;
  }, [approving, rejecting]);

  useEffect(() => {
    const pollIfReady = () => {
      if (busyRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchItems({ silent: true });
    };

    const interval = setInterval(pollIfReady, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") pollIfReady();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchItems]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/signup-requests/${approveTarget.id}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.signupRequests.errors.couldNotApprove);
      }
      setApproveTarget(null);
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signupRequests.errors.approving);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/signup-requests/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() || null }),
        },
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || t.signupRequests.errors.couldNotReject);
      }
      setRejectTarget(null);
      setRejectReason("");
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signupRequests.errors.rejecting);
    } finally {
      setRejecting(false);
    }
  };

  const total = items.length;
  const subtitle = useMemo(() => {
    if (loading) return t.signupRequests.updating;
    return `${t.signupRequests.totalLabel}: ${total}`;
  }, [loading, total, t]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              {t.signupRequests.eyebrow}
            </p>
            <h2 className="text-2xl font-semibold text-ink">{t.signupRequests.heading}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t.signupRequests.subtitle}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {STATUS_FILTER_IDS.map((id) => {
              const isActive = id === statusFilter;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-300/60 dark:bg-brand-500/20 dark:text-white"
                      : "border-stroke bg-surface text-ink-muted hover:border-brand-200 hover:text-ink dark:hover:border-brand-300/40"
                  }`}
                  aria-pressed={isActive}
                >
                  {t.signupRequests.filters[id]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{t.signupRequests.listTitle}</p>
          <span className="text-xs text-ink-soft">{subtitle}</span>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <TableShell
            loading={loading}
            hasItems={items.length > 0}
            emptyTitle={t.signupRequests.emptyTitle}
            emptyDescription={t.signupRequests.emptyDescription}
            desktop={
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
                  <tr className="text-left text-[13px] font-medium text-ink-soft">
                    <th className="px-3 py-2">{t.signupRequests.columns.email}</th>
                    <th className="px-3 py-2">{t.signupRequests.columns.name}</th>
                    <th className="px-3 py-2">{t.signupRequests.columns.organization}</th>
                    <th className="px-3 py-2">{t.signupRequests.columns.provider}</th>
                    <th className="px-3 py-2">{t.signupRequests.columns.requested}</th>
                    <th className="px-3 py-2">{t.signupRequests.columns.status}</th>
                    <th className="px-3 py-2 text-right">{t.signupRequests.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-brand-50/35"
                    >
                      <td className="px-3 py-2.5 font-semibold text-ink">
                        {item.email}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {`${item.firstName} ${item.lastName}`.trim() || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        <div className="flex flex-col">
                          <span>{item.organizationName}</span>
                          {item.organizationSlug ? (
                            <span className="text-xs text-ink-soft">
                              {item.organizationSlug}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted capitalize">
                        {item.provider}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">{statusBadge(item.status, t)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === "pending" ? (
                            <>
                              <RowActionButton
                                onClick={() => setApproveTarget(item)}
                                icon={<IconCheck className="h-4 w-4" />}
                                label={t.signupRequests.actions.approve}
                                title={t.signupRequests.actions.approve}
                              />
                              <RowActionButton
                                onClick={() => {
                                  setRejectReason("");
                                  setRejectTarget(item);
                                }}
                                icon={<IconX className="h-4 w-4" />}
                                label={t.signupRequests.actions.reject}
                                title={t.signupRequests.actions.reject}
                                tone="danger"
                              />
                            </>
                          ) : (
                            <span className="text-xs text-ink-soft">
                              {item.reviewedBy?.email ?? "—"}
                            </span>
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
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg bg-surface-elevated p-5 shadow-sm dark:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {item.email}
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {`${item.firstName} ${item.lastName}`.trim() || "—"}
                        </p>
                      </div>
                      {statusBadge(item.status, t)}
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                      <span>
                        <span className="font-medium text-ink-soft">{t.signupRequests.mobile.org}: </span>
                        {item.organizationName}
                      </span>
                      <span>
                        <span className="font-medium text-ink-soft">{t.signupRequests.mobile.provider}: </span>
                        <span className="capitalize">{item.provider}</span>
                      </span>
                      <span>
                        <span className="font-medium text-ink-soft">{t.signupRequests.mobile.requested}: </span>
                        {formatDate(item.createdAt)}
                      </span>
                      {item.status !== "pending" && item.reviewedBy ? (
                        <span>
                          <span className="font-medium text-ink-soft">{t.signupRequests.mobile.reviewedBy}: </span>
                          {item.reviewedBy.email}
                        </span>
                      ) : null}
                      {item.rejectionReason ? (
                        <span>
                          <span className="font-medium text-ink-soft">{t.signupRequests.mobile.reason}: </span>
                          {item.rejectionReason}
                        </span>
                      ) : null}
                    </div>
                    {item.status === "pending" ? (
                      <div className="mt-3 flex items-center justify-end gap-1">
                        <RowActionButton
                          onClick={() => setApproveTarget(item)}
                          icon={<IconCheck className="h-4 w-4" />}
                          label={t.signupRequests.actions.approve}
                          title={t.signupRequests.actions.approve}
                        />
                        <RowActionButton
                          onClick={() => {
                            setRejectReason("");
                            setRejectTarget(item);
                          }}
                          icon={<IconX className="h-4 w-4" />}
                          label={t.signupRequests.actions.reject}
                          title={t.signupRequests.actions.reject}
                          tone="danger"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            }
          />
        </div>
      </Card>

      <ConfirmationDialog
        open={!!approveTarget}
        title={formatMessage(t.signupRequests.approveDialog.title, { email: approveTarget?.email ?? "" })}
        description={t.signupRequests.approveDialog.description}
        confirmText={t.signupRequests.approveDialog.confirm}
        variant="info"
        onConfirm={handleApprove}
        onCancel={() => {
          if (approving) return;
          setApproveTarget(null);
        }}
        isConfirming={approving}
      />

      <ConfirmationDialog
        open={!!rejectTarget}
        title={formatMessage(t.signupRequests.rejectDialog.title, { email: rejectTarget?.email ?? "" })}
        description={
          <div className="mt-2 flex flex-col gap-3">
            <span>
              {t.signupRequests.rejectDialog.description}
            </span>
            <Input
              label={t.signupRequests.rejectDialog.reasonLabel}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t.signupRequests.rejectDialog.reasonPlaceholder}
              disabled={rejecting}
            />
          </div>
        }
        confirmText={t.signupRequests.rejectDialog.confirm}
        variant="danger"
        onConfirm={handleReject}
        onCancel={() => {
          if (rejecting) return;
          setRejectTarget(null);
          setRejectReason("");
        }}
        isConfirming={rejecting}
      />
    </div>
  );
}
