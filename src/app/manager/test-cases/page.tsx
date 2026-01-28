import { ManagerShell } from "@/components/manager/ManagerShell";
import { TestCasesPage } from "@/components/test-cases/TestCasesPage";

export default function ManagerTestCasesPage() {
  return (
    <ManagerShell>
      <TestCasesPage />
    </ManagerShell>
  );
}
