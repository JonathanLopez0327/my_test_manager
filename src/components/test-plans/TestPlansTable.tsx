"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import type {
  TestPlanRecord,
  TestPlanStatus,
  TestPlanSortBy,
  SortDir,
} from "./types";

type TestPlansTableProps = {
  items: TestPlanRecord[];
  loading: boolean;
  onEdit: (plan: TestPlanRecord) => void;
  onDelete: (plan: TestPlanRecord) => void;
  canManage?: boolean;
  sortBy: TestPlanSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: TestPlanSortBy) => void;
};

const statusTones: Record<TestPlanStatus, "success" | "warning" | "danger" | "neutral"> =
{
  draft: "neutral",
  active: "success",
  completed: "warning",
  archived: "danger",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

function statusLabel(t: Messages, status: TestPlanStatus): string {
  return t.testPlans.statuses[status] ?? status;
}

function formatDate(t: Messages, value?: string | null) {
  if (!value) return t.testPlans.noDate;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t.testPlans.noDate;
  return dateFormatter.format(parsed);
}

function getRangeText(t: Messages, plan: TestPlanRecord) {
  const start = plan.startsOn ? formatDate(t, plan.startsOn) : null;
  const end = plan.endsOn ? formatDate(t, plan.endsOn) : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return formatMessage(t.testPlans.rangeFrom, { date: start });
  if (end) return formatMessage(t.testPlans.rangeUntil, { date: end });
  return t.testPlans.noDates;
}

export function TestPlansTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
}: TestPlansTableProps) {
  const t = useT();
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle={t.testPlans.emptyTitle}
      emptyDescription={t.testPlans.emptyDescription}
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label={t.testPlans.columns.plan}
                sortKey="name"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testPlans.columns.project}
                sortKey="project"
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
                label={t.testPlans.columns.dates}
                sortKey="startsOn"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">
                {canManage ? t.common.actions : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((plan) => (
              <tr key={plan.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {plan.description ?? t.testPlans.noDescription}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">{plan.project.key}</p>
                  <p className="text-xs text-ink-muted">{plan.project.name}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[plan.status]}>
                    {statusLabel(t, plan.status)}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {getRangeText(t, plan)}
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <RowActionButton
                        onClick={() => onEdit(plan)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label={t.testPlans.editPlan}
                      />
                      <RowActionButton
                        onClick={() => onDelete(plan)}
                        icon={<IconTrash className="h-4 w-4" />}
                        label={t.testPlans.deletePlan}
                        tone="danger"
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      mobile={
        <>
        {items.map((plan) => (
          <div
            key={plan.id}
            className="rounded-lg bg-surface-elevated p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {plan.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">{plan.name}</p>
              </div>
              <Badge tone={statusTones[plan.status]}>
                {statusLabel(t, plan.status)}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {plan.project.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {plan.description ?? t.testPlans.noDescription}
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              {getRangeText(t, plan)}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onEdit(plan)}
                  icon={<IconEdit className="h-5 w-5" />}
                  label={t.testPlans.editPlan}
                  size="md"
                />
                <RowActionButton
                  onClick={() => onDelete(plan)}
                  icon={<IconTrash className="h-5 w-5" />}
                  label={t.testPlans.deletePlan}
                  tone="danger"
                  size="md"
                />
              </div>
            ) : null}
          </div>
        ))}
        </>
      }
    />
  );
}
