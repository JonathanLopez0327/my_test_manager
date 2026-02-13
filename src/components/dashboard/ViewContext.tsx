"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { OrganizationsResponse } from "../organizations/types";

function getSectionLabel(pathname: string) {
  if (pathname === "/manager") return "Overview";
  if (pathname.startsWith("/manager/organizations")) return "Organizations";
  if (pathname.startsWith("/manager/projects")) return "Projects";
  if (pathname.startsWith("/manager/users")) return "Users";
  if (pathname.startsWith("/manager/test-plans")) return "Test Plans";
  if (pathname.startsWith("/manager/test-suites")) return "Test Suites";
  if (pathname.startsWith("/manager/test-runs")) return "Test Runs";
  if (pathname.startsWith("/manager/test-cases")) return "Test Cases";
  return "Manager";
}

export function ViewContext() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  const activeOrgId = session?.user?.activeOrganizationId;

  const sectionLabel = useMemo(() => getSectionLabel(pathname), [pathname]);

  const fetchOrgContext = useCallback(async () => {
    if (!activeOrgId) {
      setOrgName(null);
      setOrgSlug(null);
      return;
    }
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const data = (await res.json()) as OrganizationsResponse;
      const activeOrg = data.items.find((org) => org.id === activeOrgId);
      setOrgName(activeOrg?.name ?? null);
      setOrgSlug(activeOrg?.slug ?? null);
    } catch {
      setOrgName(null);
      setOrgSlug(null);
    }
  }, [activeOrgId]);

  useEffect(() => {
    fetchOrgContext();
  }, [fetchOrgContext]);

  return (
    <div className="mb-3 px-1">
      <p className="text-xs font-semibold tracking-wide text-ink-soft">
        {(orgName ?? "Sin organización") + " / " + (orgSlug ?? "—")} {"\u25B8"}{" "}
        {sectionLabel}
      </p>
    </div>
  );
}
