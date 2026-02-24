"use client";

import { IconPlus, IconSearch } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type TestCasesHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  suite: string;
  onSuiteChange: (value: string) => void;
  suiteOptions: Array<{ id: string; label: string }>;
  tag: string;
  onTagChange: (value: string) => void;
  tagOptions: string[];
  onCreate: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

export function TestCasesHeader({
  query,
  onQueryChange,
  suite,
  onSuiteChange,
  suiteOptions,
  tag,
  onTagChange,
  tagOptions,
  onCreate,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: TestCasesHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Test Case Management
        </p>
        <h2 className="text-2xl font-semibold text-ink">Test Cases</h2>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:flex-1">
        <div className="relative flex w-full min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-4 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <Input
            placeholder="Search by title, suite or plan..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-11"
          />
        </div>
        <select
          value={suite}
          onChange={(event) => onSuiteChange(event.target.value)}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
        >
          <option value="">All suites</option>
          {suiteOptions.map((suiteOption) => (
            <option key={suiteOption.id} value={suiteOption.id}>
              {suiteOption.label}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
        >
          <option value="">All tags</option>
          {tagOptions.map((tagOption) => (
            <option key={tagOption} value={tagOption}>
              {tagOption}
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
            New Case
          </Button>
        ) : null}
      </div>
    </div>
  );
}
