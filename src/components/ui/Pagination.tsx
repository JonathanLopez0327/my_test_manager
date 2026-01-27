"use client";

import { IconChevronLeft, IconChevronRight } from "../icons";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

function getPages(page: number, totalPages: number) {
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  for (let current = adjustedStart; current <= end; current += 1) {
    pages.push(current);
  }
  return pages;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = getPages(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-muted">
        Page {page} of {totalPages} · {total} record(s)
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 disabled:pointer-events-none"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            className={`h-9 w-9 rounded-full text-sm font-semibold transition ${
              pageNumber === page
                ? "bg-brand-600 text-white shadow-soft-sm"
                : "border border-stroke text-ink-muted hover:bg-brand-50"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-ink-muted transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 disabled:pointer-events-none"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
