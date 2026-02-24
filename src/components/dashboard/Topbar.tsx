"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { IconChevronDown, IconMenu } from "../icons";
import { Avatar } from "../ui/Avatar";
import { ThemeToggle } from "../ui/ThemeToggle";

type TopbarProps = {
  onToggleSidebar?: () => void;
};

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = session?.user?.name ?? "Usuario";

  return (
    <header className="flex h-11 items-center justify-between border-b border-stroke bg-surface-elevated px-4 dark:bg-surface sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"
        aria-label="Toggle sidebar"
      >
        <IconMenu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-surface px-2 py-1 transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50"
          >
            <Avatar name={displayName} />
            <IconChevronDown className="h-4 w-4 text-ink-soft" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-stroke bg-surface-elevated p-2 shadow-soft-sm dark:bg-surface-muted">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-muted transition hover:bg-surface-muted hover:text-ink dark:hover:bg-surface"
              >
                Cerrar sesion
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
