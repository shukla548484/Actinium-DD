import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { PmsSchedulePanel } from "@/components/shipAccess/PmsSchedulePanel";
import { enforceCrewPageAccess } from "@/lib/auth/shipAccess";

export const dynamic = "force-dynamic";

export default async function ShipAccessPmsPage() {
  await enforceCrewPageAccess("/ship-access/pms");

  return (
    <PageShell size="wide">
      <PageHeader
        title="Planned maintenance (PMS)"
        description="Machinery maintenance schedule, overdue items, and dry dock job proposals."
      />
      <PmsSchedulePanel />
    </PageShell>
  );
}
