import Link from "next/link";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ companyId?: string }> };

export default async function NewEmployeePage({ searchParams }: Props) {
  const { companyId } = await searchParams;
  const company = companyId ? await getCompany(companyId) : null;

  return (
    <PageShell>
      <PageHeader
        title="Register employee"
        description="New employees are created in Waiting status. Assign vessels next to activate access."
        actions={
          <Button
            variant="outline"
            render={
              <Link
                href={
                  companyId
                    ? `/admin/employees/import?companyId=${encodeURIComponent(companyId)}`
                    : "/admin/employees/import"
                }
              />
            }
            nativeButton={false}
          >
            Bulk upload
          </Button>
        }
      />
      <EmployeeForm
        mode="create"
        defaultCompanyId={companyId}
        defaultCompany={
          company ? { id: company.id, name: company.name, code: company.code } : undefined
        }
      />
    </PageShell>
  );
}
