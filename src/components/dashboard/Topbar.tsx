"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { IconChevronDown, IconMenu } from "../icons";
import { ThemeToggle } from "../ui/ThemeToggle";
import { OrgSwitcher } from "./OrgSwitcher";
import { OrganizationCreateSheet } from "../organizations/OrganizationCreateSheet";
import type { OrganizationRecord } from "../organizations/types";
import { usePermissions } from "@/lib/auth/use-can";

type TopbarProps = {
  onToggleSidebar?: () => void;
};

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { data: session, update } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const displayName = session?.user?.name ?? "Usuario";
  const email = session?.user?.email ?? "";
  const { globalRoles } = usePermissions();
  const isSuperAdmin = (globalRoles as string[]).includes("super_admin");

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleOrgCreated = async (org: OrganizationRecord) => {
    await update({ activeOrganizationId: org.id });
    window.location.reload();
  };

  return (
    <header className="flex h-11 items-center justify-between border-b border-stroke bg-surface-elevated px-4 dark:bg-surface sm:px-6">
      {/* Left side: toggle + org switcher */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"
          aria-label="Toggle sidebar"
        >
          <IconMenu className="h-4 w-4" />
        </button>

        {!isSuperAdmin && (
          <OrgSwitcher
            onCreateOrg={() => setCreateOrgOpen(true)}
          />
        )}
      </div>

      {/* Right side: theme + user menu */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-200 hover:bg-surface-muted"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-ink sm:inline">
              {displayName}
            </span>
            <IconChevronDown
              className={`h-3.5 w-3.5 text-ink-soft transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-stroke bg-surface-elevated shadow-soft-sm dark:bg-surface-muted">
              <div className="border-b border-stroke px-4 py-3">
                <p className="text-sm font-semibold text-ink">{displayName}</p>
                {email && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {email}
                  </p>
                )}
              </div>

              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Editar perfil
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Configuracion
                </button>
              </div>

              <div className="border-t border-stroke p-1.5">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
                  </svg>
                  Cerrar sesion
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <OrganizationCreateSheet
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreated={handleOrgCreated}
      />
    </header>
  );
}
