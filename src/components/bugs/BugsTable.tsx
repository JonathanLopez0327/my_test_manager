"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconMenu } from "../icons";
import { Badge } from "../ui/Badge";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import type {
  BugRecord,
  BugStatus,
  BugSeverity,
  BugType,
  BugSortBy,
  SortDir,
} from "./types";

type BugsTableProps = {
  items: BugRecord[];
  loading: boolean;
  onEdit: (bug: BugRecord) => void;
  onDelete: (bug: BugRecord) => void;
  onView: (bug: BugRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  sortBy: BugSortBy | null;
  sortDir: SortDir | null;
  onSort: (column: BugSortBy) => void;
};

type DesktopContextMenuState = {
  bugId: string;
  x: number;
  y: number;
};

const statusTones: Record<BugStatus, "success" | "warning" | "danger" | "neutral"> = {
  open: "neutral",
  in_progress: "warning",
  resolved: "success",
  verified: "success",
  closed: "neutral",
  reopened: "danger",
};

const severityTones: Record<BugSeverity, "success" | "warning" | "danger" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "success",
};

function statusLabel(t: Messages, status: BugStatus): string {
  return t.bugs.statuses[status] ?? status;
}

function severityLabel(t: Messages, severity: BugSeverity): string {
  return t.bugs.severities[severity] ?? severity;
}

function typeLabel(t: Messages, type: BugType): string {
  return t.bugs.types[type] ?? type;
}

function getPriorityLabel(priority: number) {
  if (!Number.isFinite(priority)) return "P3";
  return `P${priority}`;
}

function getUserName(t: Messages, user: { fullName: string | null; email: string } | null) {
  if (!user) return t.bugs.unassigned;
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
  sortBy,
  sortDir,
  onSort,
}: BugsTableProps) {
  const t = useT();
  const [desktopContextMenu, setDesktopContextMenu] = useState<DesktopContextMenuState | null>(null);
  const [mobileMenuBugId, setMobileMenuBugId] = useState<string | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const closeDesktopContextMenu = useCallback(() => {
    setDesktopContextMenu(null);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuBugId(null);
  }, []);

  const closeAllMenus = useCallback(() => {
    closeDesktopContextMenu();
    closeMobileMenu();
  }, [closeDesktopContextMenu, closeMobileMenu]);

  const desktopMenuBug = useMemo(
    () => items.find((bug) => bug.id === desktopContextMenu?.bugId) ?? null,
    [items, desktopContextMenu?.bugId],
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
    if (!desktopContextMenu && !mobileMenuBugId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isDesktopMenuClick = desktopMenuRef.current?.contains(target);
      const isMobileMenuClick = mobileMenuRef.current?.contains(target);
      const isMobileMenuButton = (target as HTMLElement)?.closest?.("[data-bug-mobile-menu-button]");
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
  }, [desktopContextMenu, mobileMenuBugId, closeAllMenus]);

  useEffect(() => {
    if (!desktopContextMenu) return;
    const first = desktopMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [desktopContextMenu]);

  useEffect(() => {
    if (!mobileMenuBugId) return;
    const first = mobileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [mobileMenuBugId]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-muted">
        <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
        {t.bugs.loadingBugs}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
        {t.bugs.noBugs}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden max-h-[600px] overflow-y-auto md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
            <tr className="text-left text-[13px] font-medium text-ink-soft">
              <SortableHeaderCell
                label={t.bugs.columns.bug}
                sortKey="bug"
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
                label={t.bugs.columns.severity}
                sortKey="severity"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.bugs.columns.type}
                sortKey="type"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.bugs.columns.priority}
                sortKey="priority"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeaderCell
                label={t.bugs.columns.assignedTo}
                sortKey="assignedTo"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
              <th className="px-3 py-2.5 font-medium">{t.bugs.columns.testRun}</th>
              <SortableHeaderCell
                label={t.bugs.columns.comments}
                sortKey="comments"
                activeSortBy={sortBy}
                activeSortDir={sortDir}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody>
            {items.map((bug) => (
              <tr
                key={bug.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setDesktopContextMenu({
                    bugId: bug.id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                  closeMobileMenu();
                }}
                className="cursor-context-menu"
              >
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
                    {statusLabel(t, bug.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={severityTones[bug.severity]}>
                    {severityLabel(t, bug.severity)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {typeLabel(t, bug.type)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {getPriorityLabel(bug.priority)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {getUserName(t, bug.assignedTo)}
                </td>
                <td className="px-3 py-2.5 text-ink-muted truncate max-w-[150px]">
                  {bug.testRun?.name || "\u2014"}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {bug._count?.comments ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-4 md:hidden">
        {items.map((bug) => {
          const mobileMenuOpen = mobileMenuBugId === bug.id;
          return (
            <div
              key={bug.id}
              className="relative rounded-lg bg-surface-elevated p-5 shadow-sm dark:bg-surface-muted"
            >
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => onView(bug)} className="text-left">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                    {bug.project.key}
                  </p>
                  <p className="text-lg font-semibold text-ink">{bug.title}</p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTones[bug.status]}>
                    {statusLabel(t, bug.status)}
                  </Badge>
                  <button
                    type="button"
                    data-bug-mobile-menu-button
                    onClick={() => {
                      setMobileMenuBugId((current) => (current === bug.id ? null : bug.id));
                      closeDesktopContextMenu();
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-surface-muted"
                    aria-label={t.bugs.bugActions}
                    aria-haspopup="menu"
                    aria-expanded={mobileMenuOpen}
                  >
                    <IconMenu className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={severityTones[bug.severity]}>
                  {severityLabel(t, bug.severity)}
                </Badge>
                <span className="text-xs text-ink-muted">{typeLabel(t, bug.type)}</span>
                <span className="text-xs text-ink-muted">{getPriorityLabel(bug.priority)}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {formatMessage(t.bugs.assignedPrefix, { name: getUserName(t, bug.assignedTo) })}
              </p>
              {bug.testRun ? (
                <p className="mt-1 text-sm text-ink-muted">
                  {formatMessage(t.bugs.testRunPrefix, { name: bug.testRun.name || bug.testRun.id })}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ink-soft">
                {formatMessage(t.bugs.commentsCount, { count: bug._count?.comments ?? 0 })}
              </p>

              {mobileMenuOpen ? (
                <div
                  ref={mobileMenuRef}
                  role="menu"
                  aria-label={t.bugs.bugActions}
                  className="absolute right-4 top-14 z-40 min-w-[180px] rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-lg"
                  onKeyDown={handleMobileMenuKeyDown}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                    onClick={() => {
                      onView(bug);
                      closeMobileMenu();
                    }}
                  >
                    <span>{t.bugs.viewBug}</span>
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                      onClick={() => {
                        onEdit(bug);
                        closeMobileMenu();
                      }}
                    >
                      <span>{t.bugs.editBug}</span>
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-500/10"
                      onClick={() => {
                        onDelete(bug);
                        closeMobileMenu();
                      }}
                    >
                      <span>{t.bugs.deleteBug}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {desktopContextMenu && desktopMenuPosition && desktopMenuBug ? (
        <div
          ref={desktopMenuRef}
          role="menu"
          aria-label={t.bugs.bugActions}
          className="fixed z-50 min-w-[200px] rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-lg"
          style={{ top: desktopMenuPosition.top, left: desktopMenuPosition.left }}
          onKeyDown={handleDesktopMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
            onClick={() => {
              onView(desktopMenuBug);
              closeDesktopContextMenu();
            }}
          >
            <span>{t.bugs.viewBug}</span>
          </button>
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
              onClick={() => {
                onEdit(desktopMenuBug);
                closeDesktopContextMenu();
              }}
            >
              <span>{t.bugs.editBug}</span>
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-500/10"
              onClick={() => {
                onDelete(desktopMenuBug);
                closeDesktopContextMenu();
              }}
            >
              <span>{t.bugs.deleteBug}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
