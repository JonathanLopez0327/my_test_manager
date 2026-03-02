"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
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
import { Badge } from "../ui/Badge";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions.constants";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  permission: Permission;
  badge?: string | number;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navItems: NavItem[] = [
  { label: "Resumen", icon: IconGrid, href: "/manager", permission: PERMISSIONS.PROJECT_LIST },
  { label: "Organizaciones", icon: IconOrganization, href: "/manager/organizations", permission: PERMISSIONS.ORG_LIST },
  { label: "Proyectos", icon: IconFolder, href: "/manager/projects", permission: PERMISSIONS.PROJECT_LIST },
];

const groupedNavItems: NavGroup[] = [
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

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/manager" && pathname.startsWith(`${href}/`));
}

function SidebarNavItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive = isItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-200 ease-[var(--ease-emphasis)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
        isActive
          ? "bg-brand-50/40 font-medium text-brand-700"
          : "font-medium text-ink-muted hover:bg-brand-50/35 hover:text-ink"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-brand-500 transition-opacity ${
          isActive ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icon
        aria-hidden
        className={`h-5 w-5 shrink-0 transition-colors ${
          isActive ? "text-brand-600" : "text-ink-soft group-hover:text-ink-muted"
        }`}
      />
      <span className={`truncate ${collapsed ? "hidden" : ""}`}>{item.label}</span>
      {!collapsed && item.badge !== undefined ? (
        <Badge className="ml-auto px-2 py-0.5 text-[10px] tracking-normal">
          {item.badge}
        </Badge>
      ) : null}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-stroke bg-surface-elevated px-2 py-1 text-xs font-medium text-ink opacity-0 shadow-soft-xs transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-surface">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  void onToggle;
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
        {visibleNavItems.map((item) => (
          <SidebarNavItem key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-5 space-y-3 overflow-y-auto pr-1">
        {visibleGroupedNavItems.map((group) => (
          <div key={group.title} className="rounded-lg border border-transparent p-1">
            <p
              className={`px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/90 ${collapsed ? "hidden" : ""
                }`}
            >
              {group.title}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <SidebarNavItem key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
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
