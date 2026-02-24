"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { IconChevronUpDown, IconPlus } from "../icons";
import { useCan } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import type { OrganizationRecord, OrganizationsResponse } from "../organizations/types";

type OrgSwitcherProps = {
  onCreateOrg: () => void;
};

export function OrgSwitcher({ onCreateOrg }: OrgSwitcherProps) {
  const { data: session, update } = useSession();
  const [orgs, setOrgs] = useState<OrganizationRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const canCreate = useCan(PERMISSIONS.ORG_CREATE);

  const activeOrgId = session?.user?.activeOrganizationId;
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const data = (await res.json()) as OrganizationsResponse;
      setOrgs(data.items);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (!res.ok) {
        setSwitching(false);
        return;
      }
      const data = (await res.json()) as {
        activeOrganizationId: string;
        organizationRole: string;
      };
      await update({
        activeOrganizationId: data.activeOrganizationId,
      });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  const abbrev = activeOrg
    ? activeOrg.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
    : "??";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors duration-200 hover:bg-surface-muted"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          {abbrev}
        </span>
        <span className="hidden truncate text-sm font-medium text-ink sm:inline">
          {activeOrg?.name ?? "Sin organización"}
        </span>
        <IconChevronUpDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-stroke bg-surface-elevated p-2 shadow-lg dark:bg-surface-muted">
          <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
            Organizaciones
          </p>
          <div className="max-h-48 overflow-y-auto">
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  handleSwitch(org.id);
                  setOpen(false);
                }}
                disabled={switching}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${org.id === activeOrgId
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink dark:hover:bg-surface"
                  }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  {org.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{org.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {org.slug}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {canCreate && (
            <>
              <hr className="my-1 border-stroke" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateOrg();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <IconPlus className="h-4 w-4" />
                Nueva organización
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
