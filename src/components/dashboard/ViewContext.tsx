"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { OrganizationsResponse } from "../organizations/types";
import { uiMessages } from "@/lib/ui/messages";

function getSectionLabel(pathname: string) {
  if (pathname === "/manager") return "Summary";
  if (pathname.startsWith("/manager/organizations")) return "Organizations";
  if (pathname.startsWith("/manager/projects")) return "Projects";
  if (pathname.startsWith("/manager/users")) return "Users";
  if (pathname.startsWith("/manager/test-management")) return "Test Workspace";
  if (pathname.startsWith("/manager/test-runs-workspace")) return "Test Runs Workspace";
  if (pathname.startsWith("/manager/test-runs")) return "Test Runs";
  return "Manager";
}

export function ViewContext() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [orgName, setOrgName] = useState<string | null>(null);

  const activeOrgId = session?.user?.activeOrganizationId;

  const sectionLabel = useMemo(() => getSectionLabel(pathname), [pathname]);

  useEffect(() => {
    let isMounted = true;
    const loadContext = async () => {
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
        const activeOrg = data.items.find((org) => org.id === activeOrgId);
        if (isMounted) {
          setOrgName(activeOrg?.name ?? null);
        }
      } catch {
        if (isMounted) {
          setOrgName(null);
        }
      }
    };

    void loadContext();
    return () => {
      isMounted = false;
    };
  }, [activeOrgId]);

  return (
    <nav
      className="hidden items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs md:flex"
      aria-label="Breadcrumb"
    >
      <span className="font-medium text-ink-muted dark:text-[#A7B0C5]">
        {orgName ?? uiMessages.common.noOrganization}
      </span>
      <span className="text-ink-muted/50 dark:text-[#7D879C]">/</span>
      <span className="font-semibold text-ink dark:text-white">
        {sectionLabel}
      </span>
    </nav>
  );
}

