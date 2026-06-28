import { VesselForm } from "@/components/admin/VesselForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ companyId?: string }> };

export default async function NewVesselPage({ searchParams }: Props) {
  const { companyId } = await searchParams;
  const company = companyId ? await getCompany(companyId) : null;

  return (
    <PageShell>
      <PageHeader
        title="Register vessel"
        description="Add a vessel to a company. Vessel code is auto-generated as AAA-BBB if left blank."
      />
      <VesselForm
        mode="create"
        defaultCompanyId={companyId}
        defaultCompany={
          company ? { id: company.id, name: company.name, code: company.code } : undefined
        }
      />
    </PageShell>
  );
}
