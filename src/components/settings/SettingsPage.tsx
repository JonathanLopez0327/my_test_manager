"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSettings } from "../icons";
import { usePermissions } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { OrganizationsPage } from "../organizations/OrganizationsPage";
import { UsersPage } from "../users/UsersPage";

type Tab = "org" | "users";

const TABS: { id: Tab; label: string; permission: string }[] = [
  { id: "org", label: "Organization", permission: PERMISSIONS.ORG_LIST },
  { id: "users", label: "Users", permission: PERMISSIONS.USER_LIST },
];

export function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = usePermissions();

  const rawTab = searchParams.get("tab");
  const activeTab: Tab = rawTab === "users" ? "users" : "org";

  const visibleTabs = TABS.filter((t) => can(t.permission));

  const switchTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams();
      if (tab !== "org") params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <IconSettings className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Settings</h1>
            <p className="text-sm text-ink-muted">
              Manage your organization and user accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      {visibleTabs.length > 1 && (
        <div className="mb-6 border-b border-stroke">
          <nav className="-mb-px flex gap-6" aria-label="Settings tabs">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-brand-500 text-brand-600 dark:text-brand-300"
                      : "border-transparent text-ink-muted hover:border-stroke hover:text-ink"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "org" && <OrganizationsPage />}
      {activeTab === "users" && can(PERMISSIONS.USER_LIST) && <UsersPage />}
    </div>
  );
}
