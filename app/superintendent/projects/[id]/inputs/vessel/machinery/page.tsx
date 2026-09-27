"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { MachineryRegisterPanel } from "@/components/machinery/MachineryRegisterPanel";
import { SuperintendentVesselPmsPanel } from "@/components/superintendent/SuperintendentVesselPmsPanel";
import { VesselMachineryHoursPanel } from "@/components/superintendent/VesselMachineryHoursPanel";

export default function VesselMachineryPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery & PMS"
        description="Machinery register, running hours, and planned maintenance from the vessel."
      />
      <div className="space-y-8">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Machinery register</h2>
          <MachineryRegisterPanel side="office" dryDockProjectId={id} />
        </div>
        <VesselMachineryHoursPanel dryDockProjectId={id} />
        <div>
          <h2 className="mb-3 text-lg font-semibold">PMS schedule</h2>
          <SuperintendentVesselPmsPanel dryDockProjectId={id} />
        </div>
      </div>
    </PageShell>
  );
}
