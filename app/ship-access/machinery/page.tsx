"use client";

import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { MachineryDashboardPanel } from "@/components/shipAccess/MachineryDashboardPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function MachineryDashboardPage() {
  const ctx = useShipAccessContext();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery dashboard"
        description="Continuous machinery condition tracking — health score, overdue jobs, running hours, and deficiencies."
      />
      <MachineryDashboardPanel
        vesselId={ctx.vesselId ?? null}
        dryDockProjectId={ctx.dryDockProject?.id}
      />
    </PageShell>
  );
}
