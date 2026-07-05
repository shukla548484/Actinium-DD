import { notFound } from "next/navigation";
import { OrganizationCompanyDetail } from "@/components/admin/OrganizationCompanyDetail";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const module = ORGANIZATION_MODULES.companies;

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  if (module.excludeCategories?.includes(company.category)) notFound();

  return <OrganizationCompanyDetail module={module} company={company} />;
}
