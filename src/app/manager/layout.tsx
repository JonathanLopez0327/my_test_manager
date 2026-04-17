import type { ReactNode } from "react";
import { ManagerShell } from "@/components/manager/ManagerShell";
import { LicenseExpiredBanner } from "@/components/licensing/LicenseExpiredBanner";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  return (
    <ManagerShell banner={<LicenseExpiredBanner />}>{children}</ManagerShell>
  );
}

