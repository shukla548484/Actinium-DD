import Link from "next/link";
import { CompanyListPanel } from "@/components/admin/CompanyListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function AdminCompaniesPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Company management"
        description="Register master and sub companies, manage status, and view fleet structure."
        actions={
          <Button render={<Link href="/admin/companies/new" />} nativeButton={false}>
            Register company
          </Button>
        }
      />
      <CompanyListPanel />
    </PageShell>
  );
}
