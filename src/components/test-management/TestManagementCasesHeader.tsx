"use client";

import { IconDownload, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import type { TestCaseStatus } from "@/components/test-cases/types";

type TestManagementCasesHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  status: TestCaseStatus | "";
  onStatusChange: (value: TestCaseStatus | "") => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  tag: string;
  onTagChange: (value: string) => void;
  tagOptions: string[];
  onCreate: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

export function TestManagementCasesHeader({
  query,
  onQueryChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  tag,
  onTagChange,
  tagOptions,
  onCreate,
  onExportExcel,
  onExportPdf,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: TestManagementCasesHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 md:gap-4">
      <SearchInput
        placeholder="Search title, suite, or plan..."
        value={query}
        onChange={onQueryChange}
        containerClassName="min-w-[240px] flex-[1.2]"
      />
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as TestCaseStatus | "")}
        aria-label="Filter by status"
        className="h-10 min-w-[150px] flex-1 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300"
      >
        <option value="">All status</option>
        <option value="draft">Draft</option>
        <option value="ready">Ready</option>
        <option value="deprecated">Deprecated</option>
      </select>
      <select
        value={priority}
        onChange={(event) => onPriorityChange(event.target.value)}
        aria-label="Filter by priority"
        className="h-10 min-w-[140px] flex-1 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300"
      >
        <option value="">All priority</option>
        {[1, 2, 3, 4, 5].map((priorityValue) => (
          <option key={priorityValue} value={String(priorityValue)}>
            P{priorityValue}
          </option>
        ))}
      </select>
      <select
        value={tag}
        onChange={(event) => onTagChange(event.target.value)}
        className="h-10 min-w-[180px] flex-1 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300"
      >
        <option value="">All tags</option>
        {tagOptions.map((tagOption) => (
          <option key={tagOption} value={tagOption}>
            {tagOption}
          </option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-2">
        <Button onClick={onExportExcel} size="sm" variant="secondary" className="whitespace-nowrap">
          <IconDownload className="h-4 w-4" />
          Export Excel
        </Button>
        <Button onClick={onExportPdf} size="sm" variant="secondary" className="whitespace-nowrap">
          <IconDownload className="h-4 w-4" />
          Export PDF
        </Button>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300"
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
