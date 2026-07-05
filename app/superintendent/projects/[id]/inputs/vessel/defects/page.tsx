"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselDefectsPanel } from "@/components/superintendent/VesselDefectsPanel";

export default function VesselDefectsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel defects"
        description="Equipment defects reported onboard. Master-approved defects can drive spares requisitions."
      />
      <VesselDefectsPanel dryDockProjectId={id} />
    </PageShell>
  );
}
