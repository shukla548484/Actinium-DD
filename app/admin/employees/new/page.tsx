import Link from "next/link";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ companyId?: string; userType?: string }> };

export default async function NewEmployeePage({ searchParams }: Props) {
  const { companyId, userType } = await searchParams;
  const company = companyId ? await getCompany(companyId) : null;
  const userTypeFilter =
    userType === "external" || userType === "shipyard" || userType === "office" || userType === "vessel"
      ? userType
      : undefined;

  const title =
    userTypeFilter === "external"
      ? "Register external contact"
      : userTypeFilter === "shipyard"
        ? "Register shipyard contact"
        : "Register employee";

  return (
    <PageShell>
      <PageHeader
        title={title}
        description="New records are created in Waiting status. Assign vessels or activate access when ready."
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
        userTypeFilter={userTypeFilter}
        defaultCompany={
          company ? { id: company.id, name: company.name, code: company.code } : undefined
        }
      />
    </PageShell>
  );
}
