import { IconBell, IconChevronDown, IconSearch } from "../icons";
import { Avatar } from "../ui/Avatar";

export function Topbar() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stroke bg-white px-4 py-4 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Test Manager</h1>
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:justify-end md:gap-4 lg:flex-1">
        <div className="relative flex w-full min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-4 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            placeholder="Search test assets..."
            className="h-10 w-full rounded-lg border border-stroke bg-white pl-11 pr-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-stroke bg-white text-ink-muted">
          <IconBell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-1.5">
          <Avatar name="Emma Kwan" role="QA Lead" />
          <IconChevronDown className="h-4 w-4 text-ink-soft" />
        </div>
      </div>
    </header>
  );
}
