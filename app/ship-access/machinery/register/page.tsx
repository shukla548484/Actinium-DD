"use client";

import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { MachineryRegisterPanel } from "@/components/machinery/MachineryRegisterPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function MachineryRegisterPage() {
  const ctx = useShipAccessContext();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery register"
        description="Register and maintain machinery assets for this vessel — nameplate, make/model, and active status."
      />
      <MachineryRegisterPanel side="ship" vesselId={ctx.vesselId ?? null} />
    </PageShell>
  );
}
