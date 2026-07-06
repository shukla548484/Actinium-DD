import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardPortalDashboard } from "@/components/shipyard/ShipyardPortalDashboard";
import { Button } from "@/components/ui/button";
import { getShipyardPortalDashboard } from "@/lib/db/shipyardDashboard";

export const dynamic = "force-dynamic";

export default async function ShipyardDashboardPage() {
  const dashboard = await getShipyardPortalDashboard();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Shipyard dashboard"
        description="PM overview — RFQ queue, execution KPIs, timeline, critical jobs, variations, and invoices."
        actions={
          <Button render={<Link href="/shipyard/rfq" />} nativeButton={false}>
            RFQ inbox
          </Button>
        }
      />

      <ShipyardPortalDashboard data={dashboard} />
    </PageShell>
  );
}
