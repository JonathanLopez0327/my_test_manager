"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { ViewContext } from "../dashboard/ViewContext";
import { WorkspaceShell } from "../ui/WorkspaceShell";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const variant = pathname === "/manager"
    ? "default"
    : (
      {
        "/manager/ai-chat": "wide",
        "/manager/test-runs": "wide",
        "/manager/test-cases": "wide",
        "/manager/bugs": "wide",
        "/manager/organizations": "wide",
        "/manager/users": "wide",
        "/manager/projects": "wide",
        "/manager/test-plans": "wide",
        "/manager/test-suites": "wide",
      } as const
    )[pathname] ?? "default";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="h-full shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto">
          <WorkspaceShell variant={variant}>
            <ViewContext />
            {children}
          </WorkspaceShell>
        </main>
      </div>
    </div>
  );
}
