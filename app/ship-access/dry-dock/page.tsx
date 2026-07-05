"use client";

import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { DryDockReadinessDashboard } from "@/components/shipAccess/DryDockReadinessDashboard";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function DryDockPreparationPage() {
  const ctx = useShipAccessContext();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Dry dock preparation"
        description="Technical data collection engine — every voyage, PMS activity, defect, and inspection builds the next dry dock scope."
      />
      <DryDockReadinessDashboard
        vesselId={ctx.vesselId ?? null}
        dryDockProjectId={ctx.dryDockProject?.id}
      />
    </PageShell>
  );
}
