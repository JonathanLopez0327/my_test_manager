import type { ReactNode } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Topbar } from "../dashboard/Topbar";
import { ViewContext } from "../dashboard/ViewContext";

type ManagerShellProps = {
  children: ReactNode;
};

export function ManagerShell({ children }: ManagerShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6 lg:px-8">
          <ViewContext />
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
