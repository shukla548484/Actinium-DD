import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardProfilePanel } from "@/components/shipyard/ShipyardProfilePanel";
import { getOrCreateYardProfile } from "@/lib/db/yardProfile";
import { shipyardModuleById } from "@/lib/shipyard/workflow";

export const dynamic = "force-dynamic";

export default async function ShipyardProfilePage() {
  const module = shipyardModuleById("profile")!;
  const profile = await getOrCreateYardProfile();

  return (
    <PageShell size="wide">
      <PageHeader title={module.label} description={module.description} />
      {profile ? (
        <ShipyardProfilePanel initialProfile={profile} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No shipyard company registered. Add one under Admin → Shipyards, then return here to configure
          docks, workshops, cranes, and capacity.
        </p>
      )}
    </PageShell>
  );
}
