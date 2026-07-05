import Link from "next/link";
import { EmployeeListPanel } from "@/components/admin/EmployeeListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function AdminEmployeesPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Employee management"
        description="Register office staff, assign vessels, reset passwords, and manage active / waiting / inactive status."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/admin/employees/import" />} nativeButton={false}>
              Bulk upload
            </Button>
            <Button render={<Link href="/admin/employees/new" />} nativeButton={false}>
              Register employee
            </Button>
          </div>
        }
      />
      <EmployeeListPanel />
    </PageShell>
  );
}
