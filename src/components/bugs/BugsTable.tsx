"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import type { BugRecord, BugStatus, BugSeverity, BugType } from "./types";

type BugsTableProps = {
  items: BugRecord[];
  loading: boolean;
  onEdit: (bug: BugRecord) => void;
  onDelete: (bug: BugRecord) => void;
  onView: (bug: BugRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

const statusLabels: Record<BugStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  verified: "Verified",
  closed: "Closed",
  reopened: "Reopened",
};

const statusTones: Record<BugStatus, "success" | "warning" | "danger" | "neutral"> = {
  open: "neutral",
  in_progress: "warning",
  resolved: "success",
  verified: "success",
  closed: "neutral",
  reopened: "danger",
};

const severityLabels: Record<BugSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const severityTones: Record<BugSeverity, "success" | "warning" | "danger" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "success",
};

const typeLabels: Record<BugType, string> = {
  bug: "Bug",
  enhancement: "Enhancement",
  task: "Task",
};

function getPriorityLabel(priority: number) {
  if (!Number.isFinite(priority)) return "P3";
  return `P${priority}`;
}

function getUserName(user: { fullName: string | null; email: string } | null) {
  if (!user) return "Unassigned";
  return user.fullName || user.email;
}

export function BugsTable({
  items,
  loading,
  onEdit,
  onDelete,
  onView,
  canEdit = true,
  canDelete = true,
}: BugsTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Loading bugs...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No bugs to show.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <th className="px-3 py-2">Bug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Assigned To</th>
              <th className="px-3 py-2">Comments</th>
              <th className="px-3 py-2 text-right">
                {canEdit || canDelete ? "Actions" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((bug) => (
              <tr key={bug.id} className="border-t border-stroke">
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onView(bug)}
                    className="text-left hover:underline"
                  >
                    <p className="font-semibold text-ink">{bug.title}</p>
                    <p className="text-xs text-ink-muted">
                      {bug.project.key} &middot; {bug.project.name}
                    </p>
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={statusTones[bug.status]}>
                    {statusLabels[bug.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={severityTones[bug.severity]}>
                    {severityLabels[bug.severity]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {typeLabels[bug.type]}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {getPriorityLabel(bug.priority)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {getUserName(bug.assignedTo)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {bug._count?.comments ?? 0}
                </td>
                <td className="px-3 py-2.5">
                  {(canEdit || canDelete) ? (
                    <div className="flex items-center justify-end gap-2">
                      {canEdit ? (
                        <button
                          onClick={() => onEdit(bug)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Edit bug"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          onClick={() => onDelete(bug)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                          aria-label="Delete bug"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-4 md:hidden">
        {items.map((bug) => (
          <div
            key={bug.id}
            className="rounded-lg border border-stroke bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => onView(bug)} className="text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {bug.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">{bug.title}</p>
              </button>
              <Badge tone={statusTones[bug.status]}>
                {statusLabels[bug.status]}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={severityTones[bug.severity]}>
                {severityLabels[bug.severity]}
              </Badge>
              <span className="text-xs text-ink-muted">{typeLabels[bug.type]}</span>
              <span className="text-xs text-ink-muted">{getPriorityLabel(bug.priority)}</span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Assigned: {getUserName(bug.assignedTo)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {bug._count?.comments ?? 0} comments
            </p>
            {(canEdit || canDelete) ? (
              <div className="mt-4 flex items-center gap-3">
                {canEdit ? (
                  <button
                    onClick={() => onEdit(bug)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                    aria-label="Edit bug"
                  >
                    <IconEdit className="h-5 w-5" />
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    onClick={() => onDelete(bug)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                    aria-label="Delete bug"
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
