"use client";

import { IconClipboard, IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import type {
  TestRunRecord,
  TestRunStatus,
  TestRunType,
  TestRunSortBy,
  SortDir,
} from "./types";

type TestRunsTableProps = {
  items: TestRunRecord[];
  loading: boolean;
  onView: (run: TestRunRecord) => void;
  onEdit: (run: TestRunRecord) => void;
  onDelete: (run: TestRunRecord) => void;
  canManage?: boolean;
  sortBy: TestRunSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: TestRunSortBy) => void;
};

const statusLabels: Record<TestRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  canceled: "Canceled",
  failed: "Failed",
};

const statusTones: Record<
  TestRunStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  queued: "neutral",
  running: "warning",
  completed: "success",
  canceled: "neutral",
  failed: "danger",
};

const runTypeLabels: Record<TestRunType, string> = {
  manual: "Manual",
  automated: "Automated",
};

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

function getRunTitle(run: TestRunRecord) {
  if (run.name?.trim()) return run.name.trim();
  return `Run ${run.id.slice(0, 6)}`;
}

export function TestRunsTable({
  items,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
}: TestRunsTableProps) {
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle="No test runs found."
      emptyDescription="Create a new run or adjust your filters."
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label="Run"
                sortKey="run"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Project"
                sortKey="project"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Plan / Suite"
                sortKey="planSuite"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Status"
                sortKey="status"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Metrics"
                sortKey="metrics"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Type"
                sortKey="runType"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Dates"
                sortKey="dates"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">{canManage ? "Actions" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((run) => (
              <tr key={run.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{getRunTitle(run)}</p>
                  <p className="text-xs text-ink-muted">
                    {run.environment ?? "No environment"} · {run.buildNumber ?? "No build"}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">{run.branch ?? "No branch"}</p>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">
                    {run.project.key} · {run.project.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.commitSha ? run.commitSha.slice(0, 10) : "No commit"}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  <p className="font-semibold text-ink">
                    {run.testPlan?.name ?? run.suite?.testPlan.name ?? "No plan"}
                  </p>
                  <p className="text-xs text-ink-muted">{run.suite?.name ?? "No suite"}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[run.status]}>{statusLabels[run.status]}</Badge>
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  {run.metrics ? (
                    <div>
                      <p className="text-sm font-semibold text-ink">{run.metrics.passRate}%</p>
                      <p>
                        {run.metrics.passed}/{run.metrics.total} passed
                      </p>
                    </div>
                  ) : (
                    <span className="text-ink-soft">No metrics</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {runTypeLabels[run.runType]}
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  <p>Start: {formatDate(run.startedAt)}</p>
                  <p>End: {formatDate(run.finishedAt)}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <RowActionButton
                      onClick={() => onView(run)}
                      icon={<IconClipboard className="h-4 w-4" />}
                      label="View run details"
                    />
                    {canManage ? (
                      <>
                        <RowActionButton
                          onClick={() => onEdit(run)}
                          icon={<IconEdit className="h-4 w-4" />}
                          label="Edit run"
                        />
                        <RowActionButton
                          onClick={() => onDelete(run)}
                          icon={<IconTrash className="h-4 w-4" />}
                          label="Delete run"
                          tone="danger"
                        />
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      mobile={
        <>
          {items.map((run) => (
            <div
              key={run.id}
              className="rounded-lg bg-surface-elevated p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                    {run.project.key}
                  </p>
                  <p className="text-lg font-semibold text-ink">{getRunTitle(run)}</p>
                </div>
                <Badge tone={statusTones[run.status]}>{statusLabels[run.status]}</Badge>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {run.testPlan?.name ?? run.suite?.testPlan.name ?? "No plan"} · {" "}
                {run.suite?.name ?? "No suite"}
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                {run.environment ?? "No environment"} · {run.buildNumber ?? "No build"}
              </p>
              <div className="mt-3 text-sm text-ink-muted">
                {run.metrics ? (
                  <p>
                    Metrics: {run.metrics.passRate}% · {run.metrics.passed}/
                    {run.metrics.total} passed
                  </p>
                ) : (
                  <p className="text-ink-soft">Metrics: no data</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                <span>{runTypeLabels[run.runType]}</span>
                <span>{run.branch ?? "No branch"}</span>
                <span>{run.commitSha ? run.commitSha.slice(0, 10) : "No commit"}</span>
              </div>
              <div className="mt-3 text-xs text-ink-muted">
                <p>Start: {formatDate(run.startedAt)}</p>
                <p>End: {formatDate(run.finishedAt)}</p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onView(run)}
                  icon={<IconClipboard className="h-5 w-5" />}
                  label="View run details"
                  size="md"
                />
                {canManage ? (
                  <>
                    <RowActionButton
                      onClick={() => onEdit(run)}
                      icon={<IconEdit className="h-5 w-5" />}
                      label="Edit run"
                      size="md"
                    />
                    <RowActionButton
                      onClick={() => onDelete(run)}
                      icon={<IconTrash className="h-5 w-5" />}
                      label="Delete run"
                      tone="danger"
                      size="md"
                    />
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </>
      }
    />
  );
}
