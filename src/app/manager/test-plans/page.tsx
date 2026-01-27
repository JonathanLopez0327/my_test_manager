import { ManagerShell } from "@/components/manager/ManagerShell";
import { TestPlansPage } from "@/components/test-plans/TestPlansPage";

export default function ManagerTestPlansPage() {
  return (
    <ManagerShell>
      <TestPlansPage />
    </ManagerShell>
  );
}
