"use client";

import { IconClipboard, IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
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

function statusLabel(t: Messages, status: TestRunStatus): string {
  return t.testRuns.statuses[status] ?? status;
}

function runTypeLabel(t: Messages, runType: TestRunType): string {
  return t.testRuns.runTypes[runType] ?? runType;
}

function formatDate(t: Messages, value?: string | null) {
  if (!value) return t.testRuns.noDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t.testRuns.noDate;
  return date.toLocaleString();
}

function getRunTitle(t: Messages, run: TestRunRecord) {
  if (run.name?.trim()) return run.name.trim();
  return formatMessage(t.testRuns.runTitleFallback, { id: run.id.slice(0, 6) });
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
  const t = useT();
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle={t.testRuns.emptyTitle}
      emptyDescription={t.testRuns.emptyDescription}
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label={t.testRuns.columns.run}
                sortKey="run"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testRuns.columns.project}
                sortKey="project"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testRuns.columns.planSuite}
                sortKey="planSuite"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.common.status}
                sortKey="status"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testRuns.columns.metrics}
                sortKey="metrics"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testRuns.columns.type}
                sortKey="runType"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testRuns.columns.dates}
                sortKey="dates"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">{canManage ? t.common.actions : ""}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((run) => (
              <tr key={run.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{getRunTitle(t, run)}</p>
                  <p className="text-xs text-ink-muted">
                    {run.environment ?? t.testRuns.noEnvironment} · {run.buildNumber ?? t.testRuns.noBuild}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">{run.branch ?? t.testRuns.noBranch}</p>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">
                    {run.project.key} · {run.project.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {run.commitSha ? run.commitSha.slice(0, 10) : t.testRuns.noCommit}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  <p className="font-semibold text-ink">
                    {run.testPlan?.name ?? run.suite?.testPlan.name ?? t.testRuns.noPlan}
                  </p>
                  <p className="text-xs text-ink-muted">{run.suite?.name ?? t.testRuns.noSuite}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[run.status]}>{statusLabel(t, run.status)}</Badge>
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  {run.metrics ? (
                    <div>
                      <p className="text-sm font-semibold text-ink">{run.metrics.passRate}%</p>
                      <p>
                        {formatMessage(t.testRuns.passedSummary, {
                          passed: run.metrics.passed,
                          total: run.metrics.total,
                        })}
                      </p>
                    </div>
                  ) : (
                    <span className="text-ink-soft">{t.testRuns.noMetrics}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {runTypeLabel(t, run.runType)}
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  <p>{formatMessage(t.testRuns.startLabel, { date: formatDate(t, run.startedAt) })}</p>
                  <p>{formatMessage(t.testRuns.endLabel, { date: formatDate(t, run.finishedAt) })}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <RowActionButton
                      onClick={() => onView(run)}
                      icon={<IconClipboard className="h-4 w-4" />}
                      label={t.testRuns.viewRunDetails}
                    />
                    {canManage ? (
                      <>
                        <RowActionButton
                          onClick={() => onEdit(run)}
                          icon={<IconEdit className="h-4 w-4" />}
                          label={t.testRuns.editRun}
                        />
                        <RowActionButton
                          onClick={() => onDelete(run)}
                          icon={<IconTrash className="h-4 w-4" />}
                          label={t.testRuns.deleteRun}
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
                  <p className="text-lg font-semibold text-ink">{getRunTitle(t, run)}</p>
                </div>
                <Badge tone={statusTones[run.status]}>{statusLabel(t, run.status)}</Badge>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {run.testPlan?.name ?? run.suite?.testPlan.name ?? t.testRuns.noPlan} · {" "}
                {run.suite?.name ?? t.testRuns.noSuite}
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                {run.environment ?? t.testRuns.noEnvironment} · {run.buildNumber ?? t.testRuns.noBuild}
              </p>
              <div className="mt-3 text-sm text-ink-muted">
                {run.metrics ? (
                  <p>
                    {formatMessage(t.testRuns.metricsSummary, {
                      rate: run.metrics.passRate,
                      passed: run.metrics.passed,
                      total: run.metrics.total,
                    })}
                  </p>
                ) : (
                  <p className="text-ink-soft">{t.testRuns.noMetricsData}</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                <span>{runTypeLabel(t, run.runType)}</span>
                <span>{run.branch ?? t.testRuns.noBranch}</span>
                <span>{run.commitSha ? run.commitSha.slice(0, 10) : t.testRuns.noCommit}</span>
              </div>
              <div className="mt-3 text-xs text-ink-muted">
                <p>{formatMessage(t.testRuns.startLabel, { date: formatDate(t, run.startedAt) })}</p>
                <p>{formatMessage(t.testRuns.endLabel, { date: formatDate(t, run.finishedAt) })}</p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onView(run)}
                  icon={<IconClipboard className="h-5 w-5" />}
                  label={t.testRuns.viewRunDetails}
                  size="md"
                />
                {canManage ? (
                  <>
                    <RowActionButton
                      onClick={() => onEdit(run)}
                      icon={<IconEdit className="h-5 w-5" />}
                      label={t.testRuns.editRun}
                      size="md"
                    />
                    <RowActionButton
                      onClick={() => onDelete(run)}
                      icon={<IconTrash className="h-5 w-5" />}
                      label={t.testRuns.deleteRun}
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

