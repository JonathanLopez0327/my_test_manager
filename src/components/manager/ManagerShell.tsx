"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { ViewContext } from "../dashboard/ViewContext";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="h-full shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 2xl:p-10">
          <div className="mx-auto w-full max-w-[1320px]">
            <ViewContext />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
