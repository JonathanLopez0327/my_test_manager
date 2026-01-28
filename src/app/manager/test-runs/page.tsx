import { ManagerShell } from "@/components/manager/ManagerShell";
import { TestRunsPage } from "@/components/test-runs/TestRunsPage";

export default function ManagerTestRunsPage() {
  return (
    <ManagerShell>
      <TestRunsPage />
    </ManagerShell>
  );
}
