import { ManagerShell } from "@/components/manager/ManagerShell";
import { UsersPage } from "@/components/users/UsersPage";

export default function ManagerUsersPage() {
  return (
    <ManagerShell>
      <UsersPage />
    </ManagerShell>
  );
}
