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
      <p className="text-xs font-medium text-ink-muted">
        Pagina {page} de {totalPages} - {total} registros
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-60"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            className={`h-9 w-9 rounded-xl text-sm font-semibold transition-all duration-200 ease-[var(--ease-emphasis)] ${
              pageNumber === page
                ? "bg-brand-600 text-white shadow-soft-xs"
                : "border border-stroke text-ink-muted hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stroke text-ink-muted transition-all duration-200 ease-[var(--ease-emphasis)] hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-60"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
