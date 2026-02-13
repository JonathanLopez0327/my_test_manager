"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { IconBell, IconChevronDown, IconSearch } from "../icons";
import { Avatar } from "../ui/Avatar";
import type { OrganizationRecord, OrganizationsResponse } from "../organizations/types";

export function Topbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const displayName = session?.user?.name ?? "Usuario";
  const activeOrgId = session?.user?.activeOrganizationId;

  const fetchOrgName = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const data = (await res.json()) as OrganizationsResponse;
      const active = data.items.find((o) => o.id === activeOrgId);
      setOrgName(active?.name ?? null);
    } catch {
      // silent
    }
  }, [activeOrgId]);

  useEffect(() => {
    fetchOrgName();
  }, [fetchOrgName]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke bg-white px-3 py-2 sm:px-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Test Manager</h1>
        {orgName && (
          <p className="text-xs text-ink-muted">{orgName}</p>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end md:gap-3 lg:flex-1">
        {/* <div className="relative flex w-full min-w-[200px] flex-1 items-center gap-2 sm:max-w-sm">
          <span className="absolute left-3 text-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            placeholder="Search test assets..."
            className="h-9 w-full rounded-lg border border-stroke bg-white pl-10 pr-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div> */}
        {/* <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-stroke bg-white text-ink-muted">
          <IconBell className="h-5 w-5" />
        </button> */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-2.5 py-1"
          >
            <Avatar name={displayName} />
            <IconChevronDown className="h-4 w-4 text-ink-soft" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-44 rounded-lg border border-stroke bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-muted transition hover:bg-surface-muted hover:text-ink"
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
