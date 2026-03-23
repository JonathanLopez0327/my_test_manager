"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconDuplicate, IconEdit, IconMenu, IconTrash } from "../icons";
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
  onView: (testCase: TestCaseRecord) => void;
  onEdit: (testCase: TestCaseRecord) => void;
  onDelete: (testCase: TestCaseRecord) => void;
  onDuplicate: (testCase: TestCaseRecord) => void;
  canManage?: boolean;
  sortBy: TestCaseSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: TestCaseSortBy) => void;
  actionMenuMode?: "inline" | "contextual";
};

type DesktopContextMenuState = {
  testCaseId: string;
  x: number;
  y: number;
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
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  canManage = true,
  sortBy,
  sortDir,
  onSort,
  actionMenuMode = "inline",
}: TestCasesTableProps) {
  const isContextualActions = actionMenuMode === "contextual";
  const [desktopContextMenu, setDesktopContextMenu] = useState<DesktopContextMenuState | null>(null);
  const [mobileMenuCaseId, setMobileMenuCaseId] = useState<string | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const closeDesktopContextMenu = useCallback(() => {
    setDesktopContextMenu(null);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuCaseId(null);
  }, []);

  const closeAllMenus = useCallback(() => {
    closeDesktopContextMenu();
    closeMobileMenu();
  }, [closeDesktopContextMenu, closeMobileMenu]);

  const desktopMenuCase = useMemo(
    () => items.find((testCase) => testCase.id === desktopContextMenu?.testCaseId) ?? null,
    [items, desktopContextMenu?.testCaseId],
  );

  const desktopMenuPosition = useMemo(() => {
    if (!desktopContextMenu) return null;
    if (typeof window === "undefined") {
      return { left: desktopContextMenu.x, top: desktopContextMenu.y };
    }

    const menuWidth = 200;
    const menuHeight = 140;
    const padding = 8;
    const left = Math.max(
      padding,
      Math.min(desktopContextMenu.x, window.innerWidth - menuWidth - padding),
    );
    const top = Math.max(
      padding,
      Math.min(desktopContextMenu.y, window.innerHeight - menuHeight - padding),
    );
    return { left, top };
  }, [desktopContextMenu]);

  useEffect(() => {
    if (!isContextualActions || !canManage) return;
    if (!desktopContextMenu && !mobileMenuCaseId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isDesktopMenuClick = desktopMenuRef.current?.contains(target);
      const isMobileMenuClick = mobileMenuRef.current?.contains(target);
      const isMobileMenuButton = (target as HTMLElement)?.closest?.("[data-test-case-mobile-menu-button]");
      if (isDesktopMenuClick || isMobileMenuClick || isMobileMenuButton) return;
      closeAllMenus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAllMenus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeAllMenus, true);
    window.addEventListener("resize", closeAllMenus);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeAllMenus, true);
      window.removeEventListener("resize", closeAllMenus);
    };
  }, [desktopContextMenu, mobileMenuCaseId, isContextualActions, canManage, closeAllMenus]);

  useEffect(() => {
    if (!isContextualActions || !desktopContextMenu) return;
    const first = desktopMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [desktopContextMenu, isContextualActions]);

  useEffect(() => {
    if (!isContextualActions || !mobileMenuCaseId) return;
    const first = mobileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [mobileMenuCaseId, isContextualActions]);

  const handleDesktopMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusable = Array.from(
      desktopMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (focusable.length === 0) return;

    const currentIndex = focusable.findIndex((button) => button === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      focusable[nextIndex]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      (document.activeElement as HTMLButtonElement | null)?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDesktopContextMenu();
    }
  };

  const handleMobileMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusable = Array.from(
      mobileMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (focusable.length === 0) return;

    const currentIndex = focusable.findIndex((button) => button === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      focusable[nextIndex]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      (document.activeElement as HTMLButtonElement | null)?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMobileMenu();
    }
  };

  return (
    <>
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
              {!isContextualActions ? (
                <th className="px-3 py-2 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((testCase) => (
              <tr
                key={testCase.id}
                onContextMenu={(event) => {
                  if (!isContextualActions || !canManage) return;
                  event.preventDefault();
                  setDesktopContextMenu({
                    testCaseId: testCase.id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                  closeMobileMenu();
                }}
                className={isContextualActions && canManage ? "cursor-context-menu transition-colors hover:bg-brand-50/35" : "transition-colors hover:bg-brand-50/35"}
              >
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onView(testCase)}
                    className="text-left font-semibold text-ink transition-colors hover:text-brand-700"
                  >
                    {testCase.title}
                  </button>
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
                {!isContextualActions ? (
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canManage ? (
                        <>
                          <RowActionButton
                            onClick={() => onDuplicate(testCase)}
                            icon={<IconDuplicate className="h-4 w-4" />}
                            label="Duplicate case"
                          />
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
                        </>
                      ) : null}
                    </div>
                  </td>
                ) : null}
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
            className="relative rounded-lg bg-surface-elevated p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {testCase.suite.testPlan.project.key}
                </p>
                <button
                  type="button"
                  onClick={() => onView(testCase)}
                  className="text-left text-lg font-semibold text-ink transition-colors hover:text-brand-700"
                >
                  {testCase.title}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTones[testCase.status]}>
                  {statusLabels[testCase.status]}
                </Badge>
                {canManage && isContextualActions ? (
                  <button
                    type="button"
                    data-test-case-mobile-menu-button
                    onClick={() => {
                      setMobileMenuCaseId((current) => (current === testCase.id ? null : testCase.id));
                      closeDesktopContextMenu();
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-surface-muted"
                    aria-label="Case actions"
                    aria-haspopup="menu"
                    aria-expanded={mobileMenuCaseId === testCase.id}
                  >
                    <IconMenu className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
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
            {canManage && !isContextualActions ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onDuplicate(testCase)}
                  icon={<IconDuplicate className="h-5 w-5" />}
                  label="Duplicate case"
                  size="md"
                />
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
            {canManage && isContextualActions && mobileMenuCaseId === testCase.id ? (
              <div
                ref={mobileMenuRef}
                role="menu"
                aria-label="Case actions"
                className="absolute right-4 top-14 z-40 min-w-[180px] rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-lg"
                onKeyDown={handleMobileMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                  onClick={() => {
                    onDuplicate(testCase);
                    closeMobileMenu();
                  }}
                >
                  <span>Duplicate case</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                  onClick={() => {
                    onEdit(testCase);
                    closeMobileMenu();
                  }}
                >
                  <span>Edit case</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-500/10"
                  onClick={() => {
                    onDelete(testCase);
                    closeMobileMenu();
                  }}
                >
                  <span>Delete case</span>
                </button>
              </div>
            ) : null}
          </div>
        ))}
        </>
      }
      />

      {isContextualActions && canManage && desktopContextMenu && desktopMenuPosition && desktopMenuCase ? (
        <div
          ref={desktopMenuRef}
          role="menu"
          aria-label="Case actions"
          className="fixed z-50 min-w-[200px] rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-lg"
          style={{ top: desktopMenuPosition.top, left: desktopMenuPosition.left }}
          onKeyDown={handleDesktopMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
            onClick={() => {
              onDuplicate(desktopMenuCase);
              closeDesktopContextMenu();
            }}
          >
            <span>Duplicate case</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
            onClick={() => {
              onEdit(desktopMenuCase);
              closeDesktopContextMenu();
            }}
          >
            <span>Edit case</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-500/10"
            onClick={() => {
              onDelete(desktopMenuCase);
              closeDesktopContextMenu();
            }}
          >
            <span>Delete case</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
