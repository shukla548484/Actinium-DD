import { PageShell } from "@/components/layout/PageShell";
import { ShipyardDashboardHeader } from "@/components/shipyard/ShipyardDashboardHeader";
import { ShipyardPortalDashboard } from "@/components/shipyard/ShipyardPortalDashboard";
import { getShipyardPortalDashboard } from "@/lib/db/shipyardDashboard";

export const dynamic = "force-dynamic";

export default async function ShipyardDashboardPage() {
  const dashboard = await getShipyardPortalDashboard();

  return (
    <PageShell size="wide">
      <ShipyardDashboardHeader />
      <ShipyardPortalDashboard data={dashboard} />
    </PageShell>
  );
}
