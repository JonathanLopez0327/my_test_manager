import type { ReactNode } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 lg:flex-row">
        <div className="lg:shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 space-y-6">
          <Topbar />
          {children}
        </div>
      </div>
    </div>
  );
}
