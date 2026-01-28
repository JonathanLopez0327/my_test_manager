import { ManagerShell } from "@/components/manager/ManagerShell";
import { TestSuitesPage } from "@/components/test-suites/TestSuitesPage";

export default function ManagerTestSuitesPage() {
  return (
    <ManagerShell>
      <TestSuitesPage />
    </ManagerShell>
  );
}
