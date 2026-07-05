import { notFound } from "next/navigation";
import { OrganizationCompanyDetail } from "@/components/admin/OrganizationCompanyDetail";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const module = ORGANIZATION_MODULES.externalVendors;

export default async function ExternalVendorDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company || company.category !== module.category) notFound();

  return <OrganizationCompanyDetail module={module} company={company} />;
}
