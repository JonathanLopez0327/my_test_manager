"use client";

import { IconEdit, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import type { TestCaseRecord, TestCaseStatus } from "./types";

type TestCasesTableProps = {
  items: TestCaseRecord[];
  loading: boolean;
  onEdit: (testCase: TestCaseRecord) => void;
  onDelete: (testCase: TestCaseRecord) => void;
  canManage?: boolean;
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

function getStepsCount(steps: unknown) {
  return Array.isArray(steps) ? steps.length : 0;
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
}: TestCasesTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        Loading cases...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        No test cases to show.
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[600px] overflow-y-auto md:block border-b border-stroke">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Suite</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Automation</th>
              <th className="px-3 py-2 text-right">
                {canManage ? "Actions" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((testCase) => (
              <tr key={testCase.id} className="border-t border-stroke">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{testCase.title}</p>
                  <p className="text-xs text-ink-muted">
                    {testCase.description ?? "No description"}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {getStepsCount(testCase.steps)} steps
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink">
                  <p className="font-semibold">{testCase.suite.name}</p>
                  <p className="text-xs text-ink-muted">
                    {testCase.suite.testPlan.project.key} ·{" "}
                    {testCase.suite.testPlan.name}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={statusTones[testCase.status]}>
                    {statusLabels[testCase.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
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
                <td className="px-3 py-2.5 text-ink-muted">
                  {getPriorityLabel(testCase.priority)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {testCase.isAutomated
                    ? testCase.automationType ?? "Automated"
                    : "Manual"}
                </td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(testCase)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                        aria-label="Edit case"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(testCase)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                        aria-label="Delete case"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((testCase) => (
          <div
            key={testCase.id}
            className="rounded-lg border border-stroke bg-white p-5"
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
              <span>{getStepsCount(testCase.steps)} steps</span>
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
                <button
                  onClick={() => onEdit(testCase)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Edit case"
                >
                  <IconEdit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(testCase)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke text-danger-500 transition hover:bg-danger-500/10"
                  aria-label="Delete case"
                >
                  <IconTrash className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
