"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { SuperintendentVesselPmsPanel } from "@/components/superintendent/SuperintendentVesselPmsPanel";
import { VesselMachineryHoursPanel } from "@/components/superintendent/VesselMachineryHoursPanel";

export default function VesselMachineryPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery & PMS"
        description="Running hours and planned maintenance schedule from the vessel."
      />
      <div className="space-y-8">
        <VesselMachineryHoursPanel dryDockProjectId={id} />
        <div>
          <h2 className="mb-3 text-lg font-semibold">PMS schedule</h2>
          <SuperintendentVesselPmsPanel dryDockProjectId={id} />
        </div>
      </div>
    </PageShell>
  );
}
