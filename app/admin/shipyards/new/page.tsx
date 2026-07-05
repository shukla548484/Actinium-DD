import { OrganizationCompanyForm } from "@/components/admin/OrganizationCompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";

export const dynamic = "force-dynamic";

const module = ORGANIZATION_MODULES.shipyards;

export default function NewShipyardPage() {
  return (
    <PageShell>
      <PageHeader
        title={module.registerLabel}
        description="Register a dry dock or repair yard. Shipyard code is generated automatically."
      />
      <OrganizationCompanyForm mode="create" module={module} />
    </PageShell>
  );
}
