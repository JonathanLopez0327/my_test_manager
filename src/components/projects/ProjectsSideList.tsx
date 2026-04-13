"use client";

import { cn } from "@/lib/utils";
import type { ProjectRecord } from "./types";

type ProjectsSideListProps = {
  items: ProjectRecord[];
  loading: boolean;
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";

  return `Updated ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getInitials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

// Reusable selectable project list for side panels.
// Keeps loading, empty and active-item states consistent across manager views.
export function ProjectsSideList({
  items,
  loading,
  selectedProjectId,
  onSelect,
}: ProjectsSideListProps) {
  if (loading) {
    return (
      <div className="space-y-2.5 py-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-xl border border-stroke bg-surface-muted/70"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-stroke-strong bg-surface-muted/50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-ink">No projects found.</p>
        <p className="mt-1 text-xs text-ink-muted">
          Adjust your search or create a new project.
        </p>
      </div>
    );
  }

  return (
    <ul role="listbox" aria-label="Projects list" className="space-y-2">
      {items.map((project) => {
        const isSelected = selectedProjectId === project.id;

        return (
          <li key={project.id}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(project.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ease-[var(--ease-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                isSelected
                  ? "border-brand-300 bg-brand-50/70 shadow-soft-xs dark:bg-brand-500/15"
                  : "border-stroke bg-surface-elevated hover:border-brand-300 hover:bg-brand-50/35 dark:bg-surface-muted",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isSelected
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                    : "bg-surface-muted-strong text-ink-muted",
                )}
                aria-hidden="true"
              >
                {getInitials(project.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {formatUpdatedAt(project.updatedAt)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
