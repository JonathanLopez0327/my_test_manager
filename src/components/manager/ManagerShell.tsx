"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { WorkspaceShell } from "../ui/WorkspaceShell";
import { AssistantHubProvider } from "@/lib/assistant-hub";
import { AssistantHubPanel } from "@/components/assistant-hub/AssistantHubPanel";
import { AssistantHubFab } from "@/components/assistant-hub/AssistantHubFab";
import { AssistantHubRouteSync } from "@/components/assistant-hub/AssistantHubRouteSync";

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
        "/manager/bugs": "wide",
        "/manager/organizations": "wide",
        "/manager/users": "wide",
        "/manager/projects": "full",
        "/manager/test-management": "full",
        "/manager/test-runs-workspace": "full",
      } as const
    )[pathname] ?? "default";

  return (
    <AssistantHubProvider>
      <AssistantHubRouteSync pathname={pathname} />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <div className="h-full shrink-0">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <main className={cn("min-w-0 flex-1", variant === "full" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
              <WorkspaceShell variant={variant} className={variant === "full" ? "flex-1" : undefined}>
                {children}
              </WorkspaceShell>
            </main>
            <AssistantHubPanel />
          </div>
        </div>
        <AssistantHubFab />
      </div>
    </AssistantHubProvider>
  );
}
