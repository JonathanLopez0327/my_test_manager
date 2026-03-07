"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { OrganizationsResponse } from "../organizations/types";

function getSectionLabel(pathname: string) {
  if (pathname === "/manager") return "Resumen";
  if (pathname.startsWith("/manager/organizations")) return "Organizaciones";
  if (pathname.startsWith("/manager/projects")) return "Proyectos";
  if (pathname.startsWith("/manager/users")) return "Usuarios";
  if (pathname.startsWith("/manager/test-plans")) return "Planes de prueba";
  if (pathname.startsWith("/manager/test-suites")) return "Suites de prueba";
  if (pathname.startsWith("/manager/test-runs")) return "Ejecuciones";
  if (pathname.startsWith("/manager/test-cases")) return "Casos de prueba";
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
        {orgName ?? "Sin organizacion"}
      </span>
      <span className="text-ink-muted/50 dark:text-[#7D879C]">/</span>
      <span className="font-semibold text-ink dark:text-white">
        {sectionLabel}
      </span>
    </nav>
  );
}
