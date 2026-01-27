"use client";

import { useState } from "react";
import {
  IconChart,
  IconClipboard,
  IconFolder,
  IconGrid,
  IconLayers,
  IconPlus,
  IconSettings,
} from "../icons";
import { Button } from "../ui/Button";

const navItems = [
  { label: "Overview", icon: IconGrid, active: true },
  { label: "Projects", icon: IconFolder },
  { label: "Test Plans", icon: IconLayers },
  { label: "Runs", icon: IconChart },
  { label: "Cases", icon: IconClipboard },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`flex h-full w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-soft-sm backdrop-blur transition-all duration-300 lg:w-auto ${
        collapsed ? "lg:px-4" : "lg:px-6"
      } ${collapsed ? "lg:w-24" : "lg:w-[300px]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white">
            TM
          </div>
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="text-lg font-semibold text-ink">Test Manager</p>
            <p className="text-xs text-ink-soft">Quality Ops Suite</p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="hidden h-9 w-9 items-center justify-center rounded-2xl border border-stroke text-ink-muted transition hover:bg-brand-50 lg:flex"
          aria-label="Toggle sidebar"
        >
          <IconGrid className={`h-5 w-5 transition ${collapsed ? "rotate-90" : ""}`} />
        </button>
      </div>

      <Button className={`w-full justify-between ${collapsed ? "lg:justify-center" : ""}`}>
        <span className={collapsed ? "lg:hidden" : ""}>New Test Run</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <IconPlus className="h-4 w-4" />
        </span>
      </Button>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                item.active
                  ? "bg-brand-50 text-brand-700 shadow-soft-sm"
                  : "text-ink-muted hover:bg-brand-50/80 hover:text-ink"
              } ${collapsed ? "lg:justify-center" : ""}`}
            >
              <Icon className="h-5 w-5" />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className={`mt-auto rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white ${
          collapsed ? "lg:p-3" : ""
        }`}
      >
        <div className={collapsed ? "lg:hidden" : ""}>
          <p className="text-sm font-semibold">Need automation?</p>
          <p className="mt-2 text-xs text-white/80">
            Connect CI pipelines to sync runs in real time.
          </p>
        </div>
        <button className="mt-4 w-full rounded-full bg-white/15 py-2 text-xs font-semibold">
          {collapsed ? "CI" : "Connect CI"}
        </button>
      </div>

      <button
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink-muted hover:bg-brand-50/70 ${
          collapsed ? "lg:justify-center" : ""
        }`}
      >
        <IconSettings className="h-5 w-5" />
        <span className={collapsed ? "lg:hidden" : ""}>Settings</span>
      </button>
    </aside>
  );
}
