"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { Input } from "../ui/Input";
import { RowActionButton } from "../ui/RowActionButton";
import { TableShell } from "../ui/TableShell";
import { IconCheck, IconX } from "../icons";

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

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

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

function statusBadge(status: SignupRequestStatus) {
  switch (status) {
    case "pending":
      return <Badge tone="warning">Pending</Badge>;
    case "approved":
      return <Badge tone="success">Approved</Badge>;
    case "rejected":
      return <Badge tone="danger">Rejected</Badge>;
  }
}

export function SignupRequestsView() {
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
          throw new Error(data.message || "Could not load signup requests.");
        }
        const data = (await res.json()) as SignupRequestsResponse;
        setItems(data.items);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Error loading signup requests.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter],
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
        throw new Error(data.message || "Could not approve the signup request.");
      }
      setApproveTarget(null);
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error approving signup request.");
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
        throw new Error(data.message || "Could not reject the signup request.");
      }
      setRejectTarget(null);
      setRejectReason("");
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error rejecting signup request.");
    } finally {
      setRejecting(false);
    }
  };

  const total = items.length;
  const subtitle = useMemo(() => {
    if (loading) return "Updating...";
    return `Total: ${total}`;
  }, [loading, total]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Account approvals
            </p>
            <h2 className="text-2xl font-semibold text-ink">Signup requests</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Review pending signups before a license is provisioned.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {STATUS_FILTERS.map((filter) => {
              const isActive = filter.id === statusFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-300/60 dark:bg-brand-500/20 dark:text-white"
                      : "border-stroke bg-surface text-ink-muted hover:border-brand-200 hover:text-ink dark:hover:border-brand-300/40"
                  }`}
                  aria-pressed={isActive}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Requests</p>
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
            emptyTitle="No signup requests."
            emptyDescription="New signups will appear here for review."
            desktop={
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
                  <tr className="text-left text-[13px] font-medium text-ink-soft">
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Organization</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Requested</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
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
                      <td className="px-3 py-2.5">{statusBadge(item.status)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === "pending" ? (
                            <>
                              <RowActionButton
                                onClick={() => setApproveTarget(item)}
                                icon={<IconCheck className="h-4 w-4" />}
                                label="Approve request"
                                title="Approve request"
                              />
                              <RowActionButton
                                onClick={() => {
                                  setRejectReason("");
                                  setRejectTarget(item);
                                }}
                                icon={<IconX className="h-4 w-4" />}
                                label="Reject request"
                                title="Reject request"
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
                      {statusBadge(item.status)}
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                      <span>
                        <span className="font-medium text-ink-soft">Org: </span>
                        {item.organizationName}
                      </span>
                      <span>
                        <span className="font-medium text-ink-soft">Provider: </span>
                        <span className="capitalize">{item.provider}</span>
                      </span>
                      <span>
                        <span className="font-medium text-ink-soft">Requested: </span>
                        {formatDate(item.createdAt)}
                      </span>
                      {item.status !== "pending" && item.reviewedBy ? (
                        <span>
                          <span className="font-medium text-ink-soft">Reviewed by: </span>
                          {item.reviewedBy.email}
                        </span>
                      ) : null}
                      {item.rejectionReason ? (
                        <span>
                          <span className="font-medium text-ink-soft">Reason: </span>
                          {item.rejectionReason}
                        </span>
                      ) : null}
                    </div>
                    {item.status === "pending" ? (
                      <div className="mt-3 flex items-center justify-end gap-1">
                        <RowActionButton
                          onClick={() => setApproveTarget(item)}
                          icon={<IconCheck className="h-4 w-4" />}
                          label="Approve request"
                          title="Approve request"
                        />
                        <RowActionButton
                          onClick={() => {
                            setRejectReason("");
                            setRejectTarget(item);
                          }}
                          icon={<IconX className="h-4 w-4" />}
                          label="Reject request"
                          title="Reject request"
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
        title={`Approve signup for "${approveTarget?.email ?? ""}"?`}
        description="This will provision a Keygen license and create the user and organization. The applicant will be able to sign in immediately."
        confirmText="Approve"
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
        title={`Reject signup for "${rejectTarget?.email ?? ""}"?`}
        description={
          <div className="mt-2 flex flex-col gap-3">
            <span>
              The request will be marked as rejected and no license will be provisioned.
            </span>
            <Input
              label="Reason (optional)"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Add a note for future reference"
              disabled={rejecting}
            />
          </div>
        }
        confirmText="Reject"
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
