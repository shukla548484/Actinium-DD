import { EmployeeBulkPanel } from "@/components/admin/EmployeeBulkPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ companyId?: string }> };

export default async function EmployeeImportPage({ searchParams }: Props) {
  const { companyId } = await searchParams;

  return (
    <PageShell>
      <PageHeader
        title="Bulk upload employees"
        description="Download the Excel template or current employee data, then upload filled rows to register multiple employees."
      />
      <EmployeeBulkPanel defaultCompanyId={companyId} />
    </PageShell>
  );
}
