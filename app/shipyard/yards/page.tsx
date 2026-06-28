import Link from "next/link";
import { CompanyListPanel } from "@/components/admin/CompanyListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

export default function ShipyardDirectoryPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Shipyard directory"
        description="Repair yards registered as shipyard companies — contacts and status."
        actions={
          <Button render={<Link href="/admin/companies/new" />} nativeButton={false}>
            Register shipyard
          </Button>
        }
      />
      <CompanyListPanel category="shipyard" />
    </PageShell>
  );
}
