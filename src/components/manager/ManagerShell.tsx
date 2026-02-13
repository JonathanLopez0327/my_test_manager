import type { ReactNode } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { ViewContext } from "../dashboard/ViewContext";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-muted">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4">
          <ViewContext />
          {children}
        </main>
      </div>
    </div>
  );
}
