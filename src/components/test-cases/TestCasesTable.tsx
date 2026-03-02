"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import type {
  TestCaseRecord,
  TestCaseStatus,
  TestCaseStyle,
  TestCaseSortBy,
  SortDir,
} from "./types";

type TestCasesTableProps = {
  items: TestCaseRecord[];
  loading: boolean;
  onEdit: (testCase: TestCaseRecord) => void;
  onDelete: (testCase: TestCaseRecord) => void;
  canManage?: boolean;
  sortBy: TestCaseSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: TestCaseSortBy) => void;
};

const statusLabels: Record<TestCaseStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  deprecated: "Deprecated",
};

const statusTones: Record<
  TestCaseStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral",
  ready: "success",
  deprecated: "warning",
};

const styleLabels: Record<TestCaseStyle, string> = {
  step_by_step: "Step-by-Step",
  gherkin: "BDD/Gherkin",
  data_driven: "Data-Driven",
  api: "API",
};

const styleTones: Record<TestCaseStyle, "success" | "warning" | "danger" | "neutral"> = {
  step_by_step: "neutral",
  gherkin: "success",
  data_driven: "warning",
  api: "danger",
};

function getStepsLabel(steps: unknown, style?: string) {
  switch (style) {
    case "gherkin":
      return `${Array.isArray(steps) ? steps.length : 0} clauses`;
    case "data_driven": {
      const rows =
        typeof steps === "object" &&
        steps !== null &&
        "examples" in steps &&
        typeof (steps as { examples?: unknown }).examples === "object" &&
        (steps as { examples?: { rows?: unknown[] } }).examples?.rows
          ? (steps as { examples?: { rows?: unknown[] } }).examples?.rows
          : undefined;
      return `${Array.isArray(rows) ? rows.length : 0} scenarios`;
    }
    case "api":
      return "1 request";
    default:
      return `${Array.isArray(steps) ? steps.length : 0} steps`;
  }
}

function getPriorityLabel(priority: number) {
  if (!Number.isFinite(priority)) return "P3";
  return `P${priority}`;
}

export function TestCasesTable({
  items,
  loading,
  onEdit,
  onDelete,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
}: TestCasesTableProps) {
  return (
    <TableShell
      loading={loading}
      hasItems={items.length > 0}
      emptyTitle="No test cases found."
      emptyDescription="Create a new test case or adjust your filters."
      desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label="Case"
                sortKey="case"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Suite"
                sortKey="suite"
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
                label="Tags"
                sortKey="tags"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Priority"
                sortKey="priority"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label="Automation"
                sortKey="automation"
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
            {items.map((testCase) => (
              <tr key={testCase.id} className="transition-colors hover:bg-brand-50/35">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{testCase.title}</p>
                  <p className="text-xs text-ink-muted">
                    {testCase.description ?? "No description"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={styleTones[testCase.style as TestCaseStyle] ?? "neutral"}>
                      {styleLabels[testCase.style as TestCaseStyle] ?? "Step-by-Step"}
                    </Badge>
                    <span className="text-xs text-ink-soft">
                      {getStepsLabel(testCase.steps, testCase.style)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink">
                  <p className="font-semibold">{testCase.suite.name}</p>
                  <p className="text-xs text-ink-muted">
                    {testCase.suite.testPlan.project.key} ·{" "}
                    {testCase.suite.testPlan.name}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[testCase.status]}>
                    {statusLabels[testCase.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  <div className="flex flex-wrap gap-1">
                    {testCase.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                    {(testCase.tags?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-ink-muted">
                        +{testCase.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {getPriorityLabel(testCase.priority)}
                </td>
                <td className="px-3 py-3 text-ink-muted">
                  {testCase.isAutomated
                    ? testCase.automationType ?? "Automated"
                    : "Manual"}
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <RowActionButton
                        onClick={() => onEdit(testCase)}
                        icon={<IconEdit className="h-4 w-4" />}
                        label="Edit case"
                      />
                      <RowActionButton
                        onClick={() => onDelete(testCase)}
                        icon={<IconTrash className="h-4 w-4" />}
                        label="Delete case"
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
        {items.map((testCase) => (
          <div
            key={testCase.id}
            className="rounded-lg bg-surface-elevated p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {testCase.suite.testPlan.project.key}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {testCase.title}
                </p>
              </div>
              <Badge tone={statusTones[testCase.status]}>
                {statusLabels[testCase.status]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {testCase.suite.testPlan.name} · {testCase.suite.name}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              {testCase.description ?? "No description"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
              <Badge tone={styleTones[testCase.style as TestCaseStyle] ?? "neutral"}>
                {styleLabels[testCase.style as TestCaseStyle] ?? "Step-by-Step"}
              </Badge>
              <span>{getStepsLabel(testCase.steps, testCase.style)}</span>
              <span>{getPriorityLabel(testCase.priority)}</span>
              {(testCase.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {testCase.tags.map(tag => (
                    <span key={tag} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <span>
                {testCase.isAutomated
                  ? testCase.automationType ?? "Automated"
                  : "Manual"}
              </span>
            </div>
            {canManage ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onEdit(testCase)}
                  icon={<IconEdit className="h-5 w-5" />}
                  label="Edit case"
                  size="md"
                />
                <RowActionButton
                  onClick={() => onDelete(testCase)}
                  icon={<IconTrash className="h-5 w-5" />}
                  label="Delete case"
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
