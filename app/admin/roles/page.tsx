import { RoleListPanel } from "@/components/admin/RoleListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function AdminRolesPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Roles"
        description="System role catalog aligned to your RBAC hierarchy. Edit page access per role from the Page access screen."
      />
      <RoleListPanel />
    </PageShell>
  );
}
