"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
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
        "/manager/projects": "full",
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
        <main className={cn("flex-1", variant === "full" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
          <WorkspaceShell variant={variant} className={variant === "full" ? "flex-1" : undefined}>
            {children}
          </WorkspaceShell>
        </main>
      </div>
    </div>
  );
}
