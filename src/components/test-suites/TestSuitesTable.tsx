"use client";

import { IconEdit, IconTrash } from "../icons";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import type { TestSuiteRecord, TestSuiteSortBy, SortDir } from "./types";

type TestSuitesTableProps = {
  items: TestSuiteRecord[];
  loading: boolean;
  onEdit: (suite: TestSuiteRecord) => void;
  onDelete: (suite: TestSuiteRecord) => void;
  canManage?: boolean;
  sortBy: TestSuiteSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: TestSuiteSortBy) => void;
};

function getParentLabel(suite: TestSuiteRecord) {
  return suite.parent?.name ?? "Root";
}

export function TestSuitesTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
}: TestSuitesTableProps) {
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle="No test suites found."
      emptyDescription="Create a new suite or adjust your filters."
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label="Suite"
                sortKey="name"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Plan"
                sortKey="plan"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Parent"
                sortKey="parent"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Order"
                sortKey="displayOrder"
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
            {items.map((suite) => (
              <tr key={suite.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{suite.name}</p>
                  <p className="text-xs text-ink-muted">
                    {suite.description ?? "No description"}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">{suite.testPlan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {suite.testPlan.project.key} · {suite.testPlan.project.name}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {getParentLabel(suite)}
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {suite.displayOrder}
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <RowActionButton
                        onClick={() => onEdit(suite)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label="Edit suite"
                      />
                      <RowActionButton
                        onClick={() => onDelete(suite)}
                        icon={<IconTrash className="h-4 w-4" />}
                        label="Delete suite"
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
        {items.map((suite) => (
          <div
            key={suite.id}
            className="rounded-lg bg-surface-elevated p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {suite.testPlan.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">{suite.name}</p>
              </div>
              <span className="text-xs font-semibold text-ink-muted">
                Order {suite.displayOrder}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {suite.testPlan.name} · {suite.testPlan.project.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {suite.description ?? "No description"}
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              Parent: {getParentLabel(suite)}
            </p>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onEdit(suite)}
                  icon={<IconEdit className="h-5 w-5" />}
                  label="Edit suite"
                  size="md"
                />
                <RowActionButton
                  onClick={() => onDelete(suite)}
                  icon={<IconTrash className="h-5 w-5" />}
                  label="Delete suite"
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
