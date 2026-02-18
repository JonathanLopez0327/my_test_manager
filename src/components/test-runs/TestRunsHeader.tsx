"use client";

import { IconPlus, IconSearch } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type TestRunsHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

export function TestRunsHeader({
  query,
  onQueryChange,
  onCreate,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: TestRunsHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4">
      <div className="min-w-[220px] flex-1">
        <Input
          placeholder="Buscar por nombre, ambiente o branch..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          leadingIcon={<IconSearch className="h-4 w-4" />}
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 rounded-xl border border-stroke bg-surface-elevated px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300 focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          {[5, 10, 20, 30].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
        {canCreate ? (
          <Button onClick={onCreate} size="sm" className="whitespace-nowrap" variant="primary">
            <IconPlus className="h-4 w-4" />
            Nuevo run
          </Button>
        ) : null}
      </div>
    </div>
  );
}
