"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
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

const statusLabels: Record<TestPlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
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

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return dateFormatter.format(parsed);
}

function getRangeText(plan: TestPlanRecord) {
  const start = plan.startsOn ? formatDate(plan.startsOn) : null;
  const end = plan.endsOn ? formatDate(plan.endsOn) : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "No dates";
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
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle="No test plans found."
      emptyDescription="Create a new test plan or adjust your filters."
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label="Plan"
                sortKey="name"
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
                label="Status"
                sortKey="status"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Dates"
                sortKey="startsOn"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2 text-right">
                {canManage ? "Actions" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((plan) => (
              <tr key={plan.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {plan.description ?? "No description"}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">{plan.project.key}</p>
                  <p className="text-xs text-ink-muted">{plan.project.name}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[plan.status]}>
                    {statusLabels[plan.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {getRangeText(plan)}
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <RowActionButton
                        onClick={() => onEdit(plan)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label="Edit plan"
                      />
                      <RowActionButton
                        onClick={() => onDelete(plan)}
                        icon={<IconTrash className="h-4 w-4" />}
                        label="Delete plan"
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
                {statusLabels[plan.status]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {plan.project.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {plan.description ?? "No description"}
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              {getRangeText(plan)}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onEdit(plan)}
                  icon={<IconEdit className="h-5 w-5" />}
                  label="Edit plan"
                  size="md"
                />
                <RowActionButton
                  onClick={() => onDelete(plan)}
                  icon={<IconTrash className="h-5 w-5" />}
                  label="Delete plan"
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
