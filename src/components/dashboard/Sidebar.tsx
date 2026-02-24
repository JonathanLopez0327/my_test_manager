"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBug,
  IconChart,
  IconClipboard,
  IconFolder,
  IconGrid,
  IconLayers,
  IconOrganization,
  IconUsers,
} from "../icons";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";

const navItems = [
  { label: "Resumen", icon: IconGrid, href: "/manager", permission: PERMISSIONS.PROJECT_LIST },
  { label: "Organizaciones", icon: IconOrganization, href: "/manager/organizations", permission: PERMISSIONS.ORG_LIST },
  { label: "Proyectos", icon: IconFolder, href: "/manager/projects", permission: PERMISSIONS.PROJECT_LIST },
];

const groupedNavItems = [
  {
    title: "Planificacion",
    items: [
      { label: "Test Plans", icon: IconLayers, href: "/manager/test-plans", permission: PERMISSIONS.TEST_PLAN_LIST },
      { label: "Test Suites", icon: IconClipboard, href: "/manager/test-suites", permission: PERMISSIONS.TEST_SUITE_LIST },
      { label: "Test Cases", icon: IconClipboard, href: "/manager/test-cases", permission: PERMISSIONS.TEST_CASE_LIST },
    ],
  },
  {
    title: "Ejecucion",
    items: [{ label: "Test Runs", icon: IconChart, href: "/manager/test-runs", permission: PERMISSIONS.TEST_RUN_LIST }],
  },
  {
    title: "Calidad",
    items: [
      { label: "Bugs", icon: IconBug, href: "/manager/bugs", permission: PERMISSIONS.BUG_LIST },
    ],
  },
  {
    title: "Gestion",
    items: [{ label: "Usuarios", icon: IconUsers, href: "/manager/users", permission: PERMISSIONS.USER_LIST }],
  },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const visibleNavItems = navItems.filter((item) => can(item.permission));
  const visibleGroupedNavItems = groupedNavItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`flex h-screen flex-col border-r border-stroke bg-surface-elevated px-3 py-3 transition-all duration-300 dark:bg-surface ${collapsed ? "w-[72px]" : "w-[286px]"
        }`}
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <Link href="/manager" className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold tracking-wide text-white shadow-soft-xs">
            TM
          </div>
          <div className={`min-w-0 ${collapsed ? "hidden" : ""}`}>
            <p className="truncate text-base font-semibold text-ink">Test Manager</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Quality workspace</p>
          </div>
        </Link>
      </div>

      <nav className="mt-4 flex flex-col gap-1.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? pathname === item.href : false;
          const baseClass = `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-200 ease-[var(--ease-emphasis)] ${isActive
            ? "border border-brand-300 bg-brand-50 text-brand-700"
            : item.href
              ? "text-ink-muted hover:bg-brand-50 hover:text-ink"
              : "text-ink-soft"
            } ${collapsed ? "justify-center" : ""}`;

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className={baseClass}>
                <Icon className="h-5 w-5 shrink-0" />
                <span className={`${collapsed ? "hidden" : ""}`}>{item.label}</span>
              </Link>
            );
          }

          return (
            <button key={item.label} className={baseClass} disabled>
              <Icon className="h-5 w-5" />
              <span className={collapsed ? "hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-3 space-y-2 overflow-y-auto pr-1">
        {visibleGroupedNavItems.map((group) => (
          <div key={group.title} className="rounded-lg border border-transparent p-1">
            <p
              className={`px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft ${collapsed ? "hidden" : ""
                }`}
            >
              {group.title}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-200 ease-[var(--ease-emphasis)] ${isActive
                      ? "border border-brand-300 bg-brand-50 text-brand-700"
                      : "text-ink-muted hover:bg-brand-50 hover:text-ink"
                      } ${collapsed ? "justify-center px-2" : ""}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={collapsed ? "hidden" : ""}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-auto rounded-lg border border-stroke bg-surface-elevated px-3 py-3 dark:bg-surface-muted ${collapsed ? "px-2" : ""}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft ${collapsed ? "hidden" : ""}`}>
          Estado
        </p>
        <p className={`mt-1 text-sm font-semibold text-ink ${collapsed ? "hidden" : ""}`}>Workspace listo</p>
        <p className={`mt-1 text-xs text-ink-muted ${collapsed ? "hidden" : ""}`}>
          Navegacion optimizada para operaciones QA.
        </p>
      </div>
    </aside>
  );
}
