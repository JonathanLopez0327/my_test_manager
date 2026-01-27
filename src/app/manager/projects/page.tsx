import { ManagerShell } from "@/components/manager/ManagerShell";
import { ProjectsPage } from "@/components/projects/ProjectsPage";

export default function ManagerProjectsPage() {
  return (
    <ManagerShell>
      <ProjectsPage />
    </ManagerShell>
  );
}
