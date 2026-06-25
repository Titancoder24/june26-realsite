import { ProjectCreateWizard } from "@/components/projects/project-create-wizard";
import { RoleGuard } from "@/components/auth/role-guard";

export default function NewProjectPage() {
  return (
    <RoleGuard minRole="project_manager">
      <ProjectCreateWizard />
    </RoleGuard>
  );
}
