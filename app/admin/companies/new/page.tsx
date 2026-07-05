import { OrganizationCompanyForm } from "@/components/admin/OrganizationCompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";

export const dynamic = "force-dynamic";

const module = ORGANIZATION_MODULES.companies;

export default function NewCompanyPage() {
  return (
    <PageShell>
      <PageHeader
        title={module.registerLabel}
        description="Create a ship owner or ship management company. Code is generated automatically."
      />
      <OrganizationCompanyForm mode="create" module={module} />
    </PageShell>
  );
}
