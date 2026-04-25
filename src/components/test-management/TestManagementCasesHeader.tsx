"use client";

import { IconChevronDown, IconDownload, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { RefreshIconButton } from "@/components/ui/RefreshIconButton";
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
  onRefresh: () => void;
  isRefreshing?: boolean;
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
  onRefresh,
  isRefreshing = false,
  canCreate = true,
}: TestManagementCasesHeaderProps) {
  const handleExportChange = (value: string) => {
    if (value === "xlsx") onExportExcel();
    if (value === "pdf") onExportPdf();
  };

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
        <RefreshIconButton onRefresh={onRefresh} loading={isRefreshing} />
        <div className="relative flex h-10 w-[56px] items-center justify-between rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-2 transition-all duration-200 ease-[var(--ease-emphasis)] focus-within:border-brand-300 hover:border-brand-300">
          <IconDownload className="h-4 w-4 text-ink-muted" />
          <IconChevronDown className="h-3.5 w-3.5 text-ink-muted" />
          <select
            defaultValue=""
            aria-label="Export options"
            onChange={(event) => {
              if (event.target.value) {
                handleExportChange(event.target.value);
                event.target.value = "";
              }
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
          >
            <option value="" disabled className="bg-surface-elevated text-ink dark:bg-surface-muted">
              Export...
            </option>
            <option value="xlsx" className="bg-surface-elevated text-ink dark:bg-surface-muted">
              Export as Excel
            </option>
            <option value="pdf" className="bg-surface-elevated text-ink dark:bg-surface-muted">
              Export as PDF
            </option>
          </select>
        </div>
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
