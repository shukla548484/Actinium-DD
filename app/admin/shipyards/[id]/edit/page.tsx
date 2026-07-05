import { notFound } from "next/navigation";
import { OrganizationCompanyForm } from "@/components/admin/OrganizationCompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const module = ORGANIZATION_MODULES.shipyards;

export default async function EditShipyardPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company || company.category !== module.category) notFound();

  return (
    <PageShell>
      <PageHeader title={`Edit ${company.name}`} description={`Shipyard code ${company.code}`} />
      <OrganizationCompanyForm mode="edit" companyId={id} initial={company} module={module} />
    </PageShell>
  );
}
