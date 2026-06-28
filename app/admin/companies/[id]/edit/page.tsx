import { notFound } from "next/navigation";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditCompanyPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <PageShell>
      <PageHeader title={`Edit ${company.name}`} description={`Company code ${company.code}`} />
      <CompanyForm mode="edit" companyId={id} initial={company} />
    </PageShell>
  );
}
