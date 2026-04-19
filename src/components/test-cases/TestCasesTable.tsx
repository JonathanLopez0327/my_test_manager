"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconDuplicate, IconEdit, IconMenu, IconTrash } from "../icons";
import { Badge } from "../ui/Badge";
import { RowActionButton } from "../ui/RowActionButton";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { TableShell } from "../ui/TableShell";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
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

const statusTones: Record<
  TestCaseStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral",
  ready: "success",
  deprecated: "warning",
};

const styleTones: Record<TestCaseStyle, "success" | "warning" | "danger" | "neutral"> = {
  step_by_step: "neutral",
  gherkin: "success",
  data_driven: "warning",
  api: "danger",
};

function statusLabel(t: Messages, status: TestCaseStatus): string {
  return t.testCases.statuses[status] ?? status;
}

function styleLabel(t: Messages, style: TestCaseStyle | string): string {
  return t.testCases.styles[style as TestCaseStyle] ?? t.testCases.styles.step_by_step;
}

function getStepsLabel(t: Messages, steps: unknown, style?: string) {
  switch (style) {
    case "gherkin":
      return formatMessage(t.testCases.clausesCount, {
        count: Array.isArray(steps) ? steps.length : 0,
      });
    case "data_driven": {
      const rows =
        typeof steps === "object" &&
        steps !== null &&
        "examples" in steps &&
        typeof (steps as { examples?: unknown }).examples === "object" &&
        (steps as { examples?: { rows?: unknown[] } }).examples?.rows
          ? (steps as { examples?: { rows?: unknown[] } }).examples?.rows
          : undefined;
      return formatMessage(t.testCases.scenariosCount, {
        count: Array.isArray(rows) ? rows.length : 0,
      });
    }
    case "api":
      return t.testCases.apiRequest;
    default:
      return formatMessage(t.testCases.stepsCount, {
        count: Array.isArray(steps) ? steps.length : 0,
      });
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
  const t = useT();
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
        emptyTitle={t.testCases.emptyTitle}
        emptyDescription={t.testCases.emptyDescription}
        desktop={
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label={t.testCases.columns.case}
                sortKey="case"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testCases.columns.suite}
                sortKey="suite"
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
                label={t.testCases.columns.tags}
                sortKey="tags"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testCases.columns.priority}
                sortKey="priority"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.testCases.columns.automation}
                sortKey="automation"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              {!isContextualActions ? (
                <th className="px-3 py-2 text-right">{t.common.actions}</th>
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
                    {testCase.description ?? t.testCases.noDescription}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={styleTones[testCase.style as TestCaseStyle] ?? "neutral"}>
                      {styleLabel(t, testCase.style)}
                    </Badge>
                    <span className="text-xs text-ink-soft">
                      {getStepsLabel(t, testCase.steps, testCase.style)}
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
                    {statusLabel(t, testCase.status)}
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
                    ? testCase.automationType ?? t.testCases.automated
                    : t.testCases.manual}
                </td>
                {!isContextualActions ? (
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canManage ? (
                        <>
                          <RowActionButton
                            onClick={() => onDuplicate(testCase)}
                            icon={<IconDuplicate className="h-4 w-4" />}
                            label={t.testCases.duplicateCase}
                          />
                          <RowActionButton
                            onClick={() => onEdit(testCase)}
                            icon={<IconEdit className="h-4 w-4" />}
                            label={t.testCases.editCase}
                          />
                          <RowActionButton
                            onClick={() => onDelete(testCase)}
                            icon={<IconTrash className="h-4 w-4" />}
                            label={t.testCases.deleteCase}
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
                  {statusLabel(t, testCase.status)}
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
                    aria-label={t.testCases.caseActions}
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
              {testCase.description ?? t.testCases.noDescription}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
              <Badge tone={styleTones[testCase.style as TestCaseStyle] ?? "neutral"}>
                {styleLabel(t, testCase.style)}
              </Badge>
              <span>{getStepsLabel(t, testCase.steps, testCase.style)}</span>
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
                  ? testCase.automationType ?? t.testCases.automated
                  : t.testCases.manual}
              </span>
            </div>
            {canManage && !isContextualActions ? (
              <div className="mt-4 flex items-center gap-3">
                <RowActionButton
                  onClick={() => onDuplicate(testCase)}
                  icon={<IconDuplicate className="h-5 w-5" />}
                  label={t.testCases.duplicateCase}
                  size="md"
                />
                <RowActionButton
                  onClick={() => onEdit(testCase)}
                  icon={<IconEdit className="h-5 w-5" />}
                  label={t.testCases.editCase}
                  size="md"
                />
                <RowActionButton
                  onClick={() => onDelete(testCase)}
                  icon={<IconTrash className="h-5 w-5" />}
                  label={t.testCases.deleteCase}
                  tone="danger"
                  size="md"
                />
              </div>
            ) : null}
            {canManage && isContextualActions && mobileMenuCaseId === testCase.id ? (
              <div
                ref={mobileMenuRef}
                role="menu"
                aria-label={t.testCases.caseActions}
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
                  <span>{t.testCases.duplicateCase}</span>
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
                  <span>{t.testCases.editCase}</span>
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
                  <span>{t.testCases.deleteCase}</span>
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
          aria-label={t.testCases.caseActions}
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
            <span>{t.testCases.duplicateCase}</span>
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
            <span>{t.testCases.editCase}</span>
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
            <span>{t.testCases.deleteCase}</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
