export default function ManagerLoading() {
  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-12">
        <div className="h-52 animate-pulse rounded-xl border border-stroke bg-surface-muted/60 xl:col-span-8" />
        <div className="grid gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <div className="h-40 animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
          <div className="h-40 animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
          <div className="h-40 animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="h-[360px] animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
        <div className="grid gap-5">
          <div className="h-[170px] animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
          <div className="h-[170px] animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
        </div>
      </section>

      <section className="h-[340px] animate-pulse rounded-xl border border-stroke bg-surface-muted/60" />
    </div>
  );
}
