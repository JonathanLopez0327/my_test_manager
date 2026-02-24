"use client";

import { IconPlus, IconSearch } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { BugStatus, BugSeverity } from "./types";

type BugsHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  onCreate: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

const statusOptions: Array<{ value: "" | BugStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

const severityOptions: Array<{ value: "" | BugSeverity; label: string }> = [
  { value: "", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function BugsHeader({
  query,
  onQueryChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  onCreate,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: BugsHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Bug Tracking
        </p>
        <h2 className="text-2xl font-semibold text-ink">Bugs</h2>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:flex-1">
        <div className="relative flex w-full min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-4 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <Input
            placeholder="Search by title, project..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-11"
          />
        </div>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(event) => onSeverityChange(event.target.value)}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
        >
          {[5, 10, 20, 30].map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
        {canCreate ? (
          <Button onClick={onCreate} size="sm" className="whitespace-nowrap">
            <IconPlus className="h-4 w-4" />
            New Bug
          </Button>
        ) : null}
      </div>
    </div>
  );
}
