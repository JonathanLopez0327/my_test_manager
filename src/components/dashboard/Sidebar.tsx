"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChart,
  IconClipboard,
  IconFolder,
  IconGrid,
  IconLayers,
  IconPlus,
  IconSettings,
  IconUsers,
} from "../icons";

const navItems = [
  { label: "Overview", icon: IconGrid, href: "/manager" },
  { label: "Projects", icon: IconFolder, href: "/manager/projects" },
  { label: "Users", icon: IconUsers, href: "/manager/users" },
  { label: "Test Plans", icon: IconLayers, href: "/manager/test-plans" },
  { label: "Test Suites", icon: IconClipboard, href: "/manager/test-suites" },
  { label: "Test Runs", icon: IconChart, href: "/manager/test-runs" },
  { label: "Test Cases", icon: IconClipboard, href: "/manager/test-cases" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  return (
    <aside
      className={`flex h-full w-full flex-col gap-6 rounded-xl border border-stroke bg-white p-6 transition-all duration-300 lg:w-auto ${
        collapsed ? "lg:px-4" : "lg:px-6"
      } ${collapsed ? "lg:w-24" : "lg:w-[300px]"}`}
    >
      <div className="flex items-center justify-between gap-3">
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

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? pathname === item.href : false;
          const baseClass = `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            isActive
              ? "bg-brand-50 text-brand-700 shadow-soft-sm"
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

      <div
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
      </div>

      <button
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink-muted hover:bg-brand-50/70 ${
          collapsed ? "lg:justify-center" : ""
        }`}
      >
        <IconSettings className="h-5 w-5" />
        <span className={collapsed ? "lg:hidden" : ""}>Settings</span>
      </button>
    </aside>
  );
}
