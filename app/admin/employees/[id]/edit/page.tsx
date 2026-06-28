import { notFound } from "next/navigation";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { getEmployee } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditEmployeePage({ params }: Props) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <PageShell>
      <PageHeader
        title={`Edit ${employee.firstName} ${employee.lastName}`}
        description={`Employee code ${employee.employeeCode}`}
      />
      <EmployeeForm mode="edit" employeeId={id} initial={employee} />
    </PageShell>
  );
}
