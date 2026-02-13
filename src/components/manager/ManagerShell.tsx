import type { ReactNode } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { ViewContext } from "../dashboard/ViewContext";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-surface-muted lg:flex-row lg:overflow-hidden">
      <div className="shrink-0 p-4 lg:h-full lg:pr-2">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="p-4 pb-0 lg:pl-2">
          <Topbar />
        </div>
        <main className="flex-1 overflow-y-auto p-4 lg:pl-2">
          <ViewContext />
          {children}
        </main>
      </div>
    </div>
  );
}
