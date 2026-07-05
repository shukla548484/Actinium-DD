import { OrganizationCompanyForm } from "@/components/admin/OrganizationCompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";

export const dynamic = "force-dynamic";

const module = ORGANIZATION_MODULES.externalVendors;

export default function NewExternalVendorPage() {
  return (
    <PageShell>
      <PageHeader
        title={module.registerLabel}
        description="Register makers, suppliers, class societies, and other external parties."
      />
      <OrganizationCompanyForm mode="create" module={module} />
    </PageShell>
  );
}
