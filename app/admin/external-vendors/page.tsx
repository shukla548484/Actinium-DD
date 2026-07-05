import Link from "next/link";
import { OrganizationCompanyListPanel } from "@/components/admin/OrganizationCompanyListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";

export const dynamic = "force-dynamic";

const module = ORGANIZATION_MODULES.externalVendors;

export default function AdminExternalVendorsPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title={`${module.label} management`}
        description={`${module.description}. Register, edit, deactivate, or delete external vendor organizations and their portal contacts.`}
        actions={
          <Button render={<Link href={`${module.basePath}/new`} />} nativeButton={false}>
            {module.registerLabel}
          </Button>
        }
      />
      <OrganizationCompanyListPanel module={module} />
    </PageShell>
  );
}
