"use client";

import { IconPlus } from "../icons";
import { Button } from "../ui/Button";
import { SearchInput } from "../ui/SearchInput";

type TestPlansHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

export function TestPlansHeader({
  query,
  onQueryChange,
  onCreate,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: TestPlansHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-start gap-3 md:gap-4">
        <SearchInput
          placeholder="Search by name, description, or project..."
          value={query}
          onChange={onQueryChange}
          containerClassName="w-full min-w-[220px] flex-1 sm:max-w-sm"
        />
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
            New Plan
          </Button>
        ) : null}
    </div>
  );
}
