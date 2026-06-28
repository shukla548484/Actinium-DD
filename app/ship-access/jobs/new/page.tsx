"use client";

import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { VesselJobSubmitForm } from "@/components/superintendent/VesselJobSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";

export default function ShipAccessNewJobPage() {
  const ctx = useShipAccessContext();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Create scope job"
        description={
          ctx.vessel
            ? `Propose a job for ${ctx.vessel.name} (${ctx.vessel.code}).`
            : "Propose a dry dock scope job for superintendent review."
        }
      />

      {!ctx.dryDockProject && !ctx.loading ? (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            There is no active dry dock project for this vessel. You can still save draft jobs; link
            them to a project when one is opened.
          </CardContent>
        </Card>
      ) : null}

      <VesselJobSubmitForm
        dryDockProjectId={ctx.dryDockProject?.id ?? ""}
        vesselId={ctx.vesselId}
        jobsApiBase="/api/ship-access/jobs"
        readOnly={!ctx.vesselId}
      />
    </PageShell>
  );
}
