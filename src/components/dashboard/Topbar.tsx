import { IconBell, IconChevronDown, IconSearch } from "../icons";
import { Avatar } from "../ui/Avatar";

export function Topbar() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft-sm backdrop-blur sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Quality Overview
        </p>
        <h1 className="text-2xl font-semibold text-ink">Product QA Dashboard</h1>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:flex-1">
        <div className="relative flex w-full min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-4 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            placeholder="Search test assets..."
            className="h-11 w-full rounded-2xl border border-stroke bg-white/90 pl-11 pr-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-white/80 text-ink-muted">
          <IconBell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-2xl border border-stroke bg-white/80 px-3 py-2">
          <Avatar name="Emma Kwan" role="QA Lead" />
          <IconChevronDown className="h-4 w-4 text-ink-soft" />
        </div>
      </div>
    </header>
  );
}
