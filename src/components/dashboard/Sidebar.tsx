"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  IconChart,
  IconClipboard,
  IconFolder,
  IconGrid,
  IconLayers,
  IconOrganization,
  IconUsers,
} from "../icons";
import { OrgSwitcher } from "./OrgSwitcher";
import { OrganizationCreateSheet } from "../organizations/OrganizationCreateSheet";
import type { OrganizationRecord } from "../organizations/types";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions.constants";

const navItems = [
  { label: "Overview", icon: IconGrid, href: "/manager", permission: PERMISSIONS.PROJECT_LIST },
  { label: "Organizaciones", icon: IconOrganization, href: "/manager/organizations", permission: PERMISSIONS.ORG_LIST },
  { label: "Projects", icon: IconFolder, href: "/manager/projects", permission: PERMISSIONS.PROJECT_LIST },
];

const groupedNavItems = [
  {
    title: "Planning",
    items: [
      { label: "Test Plans", icon: IconLayers, href: "/manager/test-plans", permission: PERMISSIONS.TEST_PLAN_LIST },
      { label: "Test Suites", icon: IconClipboard, href: "/manager/test-suites", permission: PERMISSIONS.TEST_SUITE_LIST },
      { label: "Test Cases", icon: IconClipboard, href: "/manager/test-cases", permission: PERMISSIONS.TEST_CASE_LIST },
    ],
  },
  {
    title: "Execution",
    items: [{ label: "Test Runs", icon: IconChart, href: "/manager/test-runs", permission: PERMISSIONS.TEST_RUN_LIST }],
  },
  {
    title: "Management",
    items: [{ label: "Users", icon: IconUsers, href: "/manager/users", permission: PERMISSIONS.USER_LIST }],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const { update } = useSession();
  const pathname = usePathname();
  const { can, globalRoles } = usePermissions();

  const isSuperAdmin = (globalRoles as string[]).includes("super_admin");

  const visibleNavItems = navItems.filter((item) => can(item.permission));
  const visibleGroupedNavItems = groupedNavItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const handleOrgCreated = async (org: OrganizationRecord) => {
    await update({ activeOrganizationId: org.id });
    window.location.reload();
  };

  return (
    <aside
      className={`flex h-screen w-full flex-col gap-3 border-r border-stroke bg-surface transition-all duration-300 lg:w-auto ${
        collapsed ? "lg:w-20" : "lg:w-[280px]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
            TM
          </div>
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="text-lg font-semibold text-ink">Test Manager</p>
            <p className="text-xs text-ink-soft">Quality Ops Suite</p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-muted transition hover:bg-brand-50 lg:flex"
          aria-label="Toggle sidebar"
        >
          <IconGrid className={`h-5 w-5 transition ${collapsed ? "rotate-90" : ""}`} />
        </button>
      </div>

      {!isSuperAdmin && (
        <>
          <hr className="border-stroke/70" />
          <div className="px-3">
            <OrgSwitcher
              collapsed={collapsed}
              onCreateOrg={() => setCreateOrgOpen(true)}
            />
          </div>
          <hr className="border-stroke/70" />
        </>
      )}

      <nav className="flex flex-col gap-1 px-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? pathname === item.href : false;
          const baseClass = `flex items-center gap-3 rounded-xl px-4 py-1 text-[13px] font-semibold transition ${
            isActive
              ? "bg-brand-50 text-brand-700"
              : item.href
                ? "text-ink-muted hover:bg-brand-50/80 hover:text-ink"
                : "text-ink-soft"
          } ${collapsed ? "lg:justify-center" : ""}`;

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className={baseClass}>
                <Icon className="h-5 w-5" />
                <span className={collapsed ? "lg:hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <button key={item.label} className={baseClass} disabled>
              <Icon className="h-5 w-5" />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="space-y-1 px-2">
        {visibleGroupedNavItems.map((group) => (
          <div
            key={group.title}
            className="py-0.5"
          >
            <p
              className={`px-2 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-soft/60 ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-1 text-[13px] font-semibold transition ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-muted hover:bg-brand-50/80 hover:text-ink"
                    } ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* <div
        className={`mt-auto rounded-xl border border-stroke bg-surface-muted p-5 text-ink ${
          collapsed ? "lg:p-3" : ""
        }`}
      >
        <div className={collapsed ? "lg:hidden" : ""}>
          <p className="text-sm font-semibold">Need automation?</p>
          <p className="mt-2 text-xs text-ink-muted">
            Connect CI pipelines to sync runs in real time.
          </p>
        </div>
        <button className="mt-4 w-full rounded-lg border border-stroke bg-white py-2 text-xs font-semibold text-ink">
          {collapsed ? "CI" : "Connect CI"}
        </button>
      </div> */}

      {/* <button
        className={`flex items-center gap-3 rounded-xl px-4 py-1 text-[13px] font-semibold text-ink-muted hover:bg-brand-50/70 ${
          collapsed ? "lg:justify-center" : ""
        }`}
      >
        <IconSettings className="h-5 w-5" />
        <span className={collapsed ? "lg:hidden" : ""}>Settings</span>
      </button> */}

      <OrganizationCreateSheet
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreated={handleOrgCreated}
      />
    </aside>
  );
}
