import { VesselForm } from "@/components/admin/VesselForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { getCompany, listCompaniesForSelect } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ companyId?: string }> };

export default async function NewVesselPage({ searchParams }: Props) {
  const { companyId } = await searchParams;
  const [company, companies] = await Promise.all([
    companyId ? getCompany(companyId) : Promise.resolve(null),
    listCompaniesForSelect(false),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Register vessel"
        description="Add a vessel to a company. Choose Manual entry or Auto-generated unique vessel code (AAA-BBB)."
      />
      <VesselForm
        mode="create"
        defaultCompanyId={companyId}
        defaultCompany={
          company ? { id: company.id, name: company.name, code: company.code } : undefined
        }
        initialCompanies={companies.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }))}
      />
    </PageShell>
  );
}
