import { PropertyEditor } from "@/components/properties/property-editor";
import { RoleGuard } from "@/components/auth/role-guard";

export default async function PropertyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RoleGuard minRole="project_manager">
      <PropertyEditor propertyId={id} />
    </RoleGuard>
  );
}
