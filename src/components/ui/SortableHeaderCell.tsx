import { IconChevronDown, IconChevronUp, IconChevronUpDown } from "../icons";
import type { SortDir } from "@/lib/sorting";

type SortableHeaderCellProps<TSortBy extends string> = {
  label: string;
  sortKey: TSortBy;
  activeSortBy: TSortBy | null;
  activeSortDir: SortDir | null;
  onSort: (sortKey: TSortBy) => void;
  className?: string;
};

export function SortableHeaderCell<TSortBy extends string>({
  label,
  sortKey,
  activeSortBy,
  activeSortDir,
  onSort,
  className = "px-3 py-2",
}: SortableHeaderCellProps<TSortBy>) {
  const isActive = activeSortBy === sortKey;
  const ariaSort: "none" | "ascending" | "descending" =
    !isActive || !activeSortDir
      ? "none"
      : activeSortDir === "asc"
        ? "ascending"
        : "descending";

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-ink"
      >
        <span>{label}</span>
        {isActive ? (
          activeSortDir === "asc" ? (
            <IconChevronUp className="h-3.5 w-3.5" />
          ) : (
            <IconChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <IconChevronUpDown className="h-3.5 w-3.5 opacity-70" />
        )}
      </button>
    </th>
  );
}
