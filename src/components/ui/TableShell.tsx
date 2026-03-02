import type { ReactNode } from "react";

type TableShellProps = {
  loading: boolean;
  hasItems: boolean;
  desktop: ReactNode;
  mobile: ReactNode;
  loadingRows?: number;
  emptyTitle: string;
  emptyDescription: string;
  desktopContainerClassName?: string;
  mobileContainerClassName?: string;
};

export function TableShell({
  loading,
  hasItems,
  desktop,
  mobile,
  loadingRows = 3,
  emptyTitle,
  emptyDescription,
  desktopContainerClassName = "hidden max-h-[600px] overflow-y-auto md:block",
  mobileContainerClassName = "grid gap-4 md:hidden",
}: TableShellProps) {
  if (loading) {
    return (
      <div className="grid gap-3 py-2">
        {Array.from({ length: loadingRows }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-lg border border-stroke bg-surface-muted/80"
          />
        ))}
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-strong bg-surface-muted/50 px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">{emptyTitle}</p>
        <p className="mt-2 text-sm text-ink-muted">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <div className={desktopContainerClassName}>{desktop}</div>
      <div className={mobileContainerClassName}>{mobile}</div>
    </>
  );
}
