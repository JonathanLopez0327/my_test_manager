"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { IconChevronDown } from "../icons";
import { Avatar } from "../ui/Avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import type { OrganizationsResponse } from "../organizations/types";

function getViewTitle(pathname: string) {
  if (pathname === "/manager") return "Panel de calidad";
  if (pathname.startsWith("/manager/organizations")) return "Organizaciones";
  if (pathname.startsWith("/manager/projects")) return "Proyectos";
  if (pathname.startsWith("/manager/users")) return "Usuarios";
  if (pathname.startsWith("/manager/test-plans")) return "Planes de prueba";
  if (pathname.startsWith("/manager/test-suites")) return "Suites de prueba";
  if (pathname.startsWith("/manager/test-runs")) return "Ejecuciones de prueba";
  if (pathname.startsWith("/manager/test-cases")) return "Casos de prueba";
  return "Manager";
}

export function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const displayName = session?.user?.name ?? "Usuario";
  const activeOrgId = session?.user?.activeOrganizationId;
  const viewTitle = getViewTitle(pathname);

  useEffect(() => {
    let isMounted = true;
    const loadOrg = async () => {
      if (!activeOrgId) {
        if (isMounted) {
          setOrgName(null);
        }
        return;
      }

      try {
        const res = await fetch("/api/organizations");
        if (!res.ok) return;
        const data = (await res.json()) as OrganizationsResponse;
        const active = data.items.find((o) => o.id === activeOrgId);
        if (isMounted) {
          setOrgName(active?.name ?? null);
        }
      } catch {
        if (isMounted) {
          setOrgName(null);
        }
      }
    };
    void loadOrg();

    return () => {
      isMounted = false;
    };
  }, [activeOrgId]);

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-stroke bg-surface-elevated px-4 py-3 shadow-[0px_1px_2px_0px_rgba(84,87,118,0.12)] dark:bg-surface sm:px-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Test Manager
        </p>
        <h1 className="truncate text-2xl font-semibold text-ink">{viewTitle}</h1>
        {orgName && (
          <p className="text-xs font-medium text-ink-muted">{orgName}</p>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end md:gap-3 lg:flex-1">
        <ThemeToggle />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-surface px-2.5 py-1.5 transition-all duration-200 ease-[var(--ease-emphasis)] hover:border-brand-300 hover:bg-brand-50"
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
