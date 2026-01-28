"use client";

import { IconPlus, IconSearch } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type TestSuitesHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  canCreate?: boolean;
};

export function TestSuitesHeader({
  query,
  onQueryChange,
  onCreate,
  pageSize,
  onPageSizeChange,
  canCreate = true,
}: TestSuitesHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Gestión de suites de prueba
        </p>
        <h2 className="text-2xl font-semibold text-ink">Test Suites</h2>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:flex-1">
        <div className="relative flex w-full min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-4 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <Input
            placeholder="Buscar por nombre, plan o proyecto..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-11"
          />
        </div>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 rounded-xl border border-stroke bg-white px-3 text-sm text-ink"
        >
          {[5, 10, 20, 30].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
        {canCreate ? (
          <Button onClick={onCreate} size="sm" className="whitespace-nowrap">
            <IconPlus className="h-4 w-4" />
            Nueva suite
          </Button>
        ) : null}
      </div>
    </div>
  );
}
