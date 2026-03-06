import type { ReactNode } from "react";
import { ManagerShell } from "@/components/manager/ManagerShell";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  return <ManagerShell>{children}</ManagerShell>;
}

