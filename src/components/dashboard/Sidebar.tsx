"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  IconBug,
  IconChevronDown,
  IconFolder,
  IconGrid,
  IconLayers,
  IconOrganization,
  IconSettings,
} from "../icons";
import { Badge } from "../ui/Badge";
import { BrandLogo } from "../ui/BrandLogo";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions.constants";

type NavItem = {
  type: "item";
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  permission: Permission;
  badge?: string | number;
};

type NavGroupItem = {
  type: "group";
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: Array<{
    id: string;
    label: string;
    href: string;
    permission: Permission;
  }>;
};

type NavNode = NavItem | NavGroupItem;

type NavSection = {
  id: string;
  title: string;
  nodes: NavNode[];
};

const navSections: NavSection[] = [
  {
    id: "pages",
    title: "PAGES",
    nodes: [
      {
        type: "item",
        id: "dashboard",
        label: "Dashboard",
        icon: IconGrid,
        href: "/manager",
        permission: PERMISSIONS.PROJECT_LIST,
      },
      {
        type: "item",
        id: "projects",
        label: "Projects",
        icon: IconFolder,
        href: "/manager/projects",
        permission: PERMISSIONS.PROJECT_LIST,
      },
      {
        type: "group",
        id: "planning",
        label: "Test Management",
        icon: IconLayers,
        children: [
          { id: "test-workspace", label: "Test Workspace", href: "/manager/test-management", permission: PERMISSIONS.TEST_CASE_LIST },
          { id: "test-runs-workspace", label: "Test Runs Workspace", href: "/manager/test-runs-workspace", permission: PERMISSIONS.TEST_RUN_LIST },
          { id: "test-runs", label: "Test Runs", href: "/manager/test-runs", permission: PERMISSIONS.TEST_RUN_LIST },
        ],
      },
      {
        type: "item",
        id: "bugs",
        label: "Bugs",
        icon: IconBug,
        href: "/manager/bugs",
        permission: PERMISSIONS.BUG_LIST,
      },
      {
        type: "group",
        id: "org-admin",
        label: "Administration",
        icon: IconOrganization,
        children: [
          { id: "organizations", label: "Organizations", href: "/manager/organizations", permission: PERMISSIONS.ORG_LIST },
          { id: "users", label: "Users", href: "/manager/users", permission: PERMISSIONS.USER_LIST },
        ],
      },
    ],
  },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/manager" && pathname.startsWith(`${href}/`));
}

function getActiveGroupId(pathname: string, nodes: NavNode[]) {
  for (const node of nodes) {
    if (node.type === "group") {
      if (node.children.some((child) => isItemActive(pathname, child.href))) {
        return node.id;
      }
    }
  }
  return null;
}

function SidebarLeafItem({
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
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-200 ease-[var(--ease-emphasis)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${isActive
        ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/35 dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.45)]"
        : "font-medium text-ink-muted hover:bg-brand-50/45 hover:text-ink dark:text-[#A7B0C5] dark:hover:bg-white/5 dark:hover:text-white"
        } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-brand-500 transition-opacity dark:bg-brand-200 ${isActive ? "opacity-100" : "opacity-0"
          }`}
      />
      <Icon
        aria-hidden
        className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-brand-600 dark:text-white" : "text-ink-soft group-hover:text-ink-muted dark:text-[#7D879C] dark:group-hover:text-[#B5BED2]"
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

function SidebarContent({
  collapsed,
  pathname,
  can,
}: {
  collapsed: boolean;
  pathname: string;
  can: (permission: Permission) => boolean;
}) {
  const visibleSections = useMemo(() => {
    return navSections
      .map((section) => {
        const visibleNodes = section.nodes.reduce<NavNode[]>((acc, node) => {
          if (node.type === "item") {
            if (can(node.permission)) acc.push(node);
            return acc;
          }

          const children = node.children.filter((child) => can(child.permission));
          if (children.length > 0) {
            acc.push({ ...node, children });
          }

          return acc;
        }, []);
        return { ...section, nodes: visibleNodes };
      })
      .filter((section) => section.nodes.length > 0);
  }, [can]);

  const defaultOpenGroupId = useMemo(() => {
    const firstSection = visibleSections[0];
    if (!firstSection) return null;
    return getActiveGroupId(pathname, firstSection.nodes);
  }, [pathname, visibleSections]);
  const [openGroupId, setOpenGroupId] = useState<string | null>(defaultOpenGroupId);

  const renderGroup = (node: NavGroupItem) => {
    const isGroupActive = node.children.some((child) => isItemActive(pathname, child.href));
    const isOpen = !collapsed && openGroupId === node.id;
    const Icon = node.icon;

    return (
      <div
        key={node.id}
        className={`rounded-xl border p-1 transition-colors ${isOpen || isGroupActive
          ? "border-brand-100 bg-brand-50/55 dark:border-brand-300/35 dark:bg-brand-500/12"
          : "border-transparent dark:border-transparent"
          }`}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpenGroupId((prev) => (prev === node.id ? null : node.id))}
          className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${isGroupActive
            ? "text-brand-700 dark:text-white"
            : "text-ink-muted hover:bg-brand-50/45 hover:text-ink dark:text-[#A7B0C5] dark:hover:bg-white/5 dark:hover:text-white"
            } ${collapsed ? "justify-center px-2" : ""}`}
        >
          <Icon
            className={`h-5 w-5 shrink-0 ${isGroupActive
              ? "text-brand-600 dark:text-white"
              : "text-ink-soft group-hover:text-ink-muted dark:text-[#7D879C] dark:group-hover:text-[#B5BED2]"
              }`}
          />
          <span className={`${collapsed ? "hidden" : "truncate"}`}>{node.label}</span>
          {!collapsed ? (
            <IconChevronDown
              className={`ml-auto h-4 w-4 text-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          ) : null}
        </button>

        {isOpen ? (
          <div className="mt-0.5 flex flex-col gap-0.5 pl-10 pr-1 pb-1">
            {node.children.map((child) => {
              const isActive = isItemActive(pathname, child.href);
              return (
                <Link
                  key={child.id}
                  href={child.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-md px-2 py-1.5 text-[15px] transition-colors ${isActive
                    ? "bg-brand-100/60 font-semibold text-brand-700 dark:bg-brand-500/28 dark:text-white"
                    : "text-ink-muted hover:text-ink dark:text-[#A7B0C5] dark:hover:text-white"
                    }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside
      className={`flex h-screen flex-col overflow-hidden rounded-br-2xl border-r border-stroke bg-surface px-3 py-4 transition-all duration-300 dark:bg-surface ${collapsed ? "w-[74px]" : "w-[276px]"
        }`}
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <Link href="/manager" className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <BrandLogo
            variant={collapsed ? "icon" : "full"}
            className={collapsed ? "h-11 w-11 rounded-md object-contain" : "h-12 w-auto object-contain"}
            priority
          />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">My Test Manager</p>
            </div>
          ) : null}
        </Link>
      </div>

      <div className="mt-3 space-y-3 overflow-y-auto pr-1">
        {visibleSections.map((section) => (
          <div key={section.id}>
            <p className={`px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft dark:text-[#7D879C] ${collapsed ? "hidden" : ""}`}>
              {section.title}
            </p>
            <nav className="flex flex-col gap-1">
              {section.nodes.map((node) =>
                node.type === "item"
                  ? (
                    <SidebarLeafItem
                      key={node.id}
                      item={node}
                      pathname={pathname}
                      collapsed={collapsed}
                    />
                  )
                  : renderGroup(node)
              )}
            </nav>
          </div>
        ))}
      </div>

      {/* <div className={`mt-auto rounded-xl border border-stroke bg-surface-muted px-3 py-3 dark:border-[#2A354C] dark:bg-[#141C2E] ${collapsed ? "px-2" : ""}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft dark:text-[#7D879C] ${collapsed ? "hidden" : ""}`}>
          Estado
        </p>
        <p className={`mt-1 text-sm font-semibold text-ink dark:text-[#E5EBFA] ${collapsed ? "hidden" : ""}`}>Workspace listo</p>
        <p className={`mt-1 text-xs text-ink-muted dark:text-[#A7B0C5] ${collapsed ? "hidden" : ""}`}>
          Navegacion optimizada para operaciones QA.
        </p>
      </div> */}
    </aside>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  void onToggle;
  const pathname = usePathname();
  const { can } = usePermissions();

  return <SidebarContent key={pathname} collapsed={collapsed} pathname={pathname} can={can} />;
}
