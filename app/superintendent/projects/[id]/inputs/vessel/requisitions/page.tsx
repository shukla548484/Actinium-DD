"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselRequisitionBankPanel } from "@/components/superintendent/VesselRequisitionBankPanel";
import { VesselRequisitionsPanel } from "@/components/superintendent/VesselRequisitionsPanel";
import { useProjectVessel } from "@/components/superintendent/useProjectVessel";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function VesselRequisitionsPage() {
  const { id } = useParams<{ id: string }>();
  const { vesselId, loading } = useProjectVessel(id);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel requisitions"
        description="Spares requisitions raised from Master-approved defects. Convert approved items into project spares."
      />

      {loading ? (
        <ActiniumLoadingState size="sm" />
      ) : (
        <div className="space-y-6">
          <VesselRequisitionBankPanel dryDockProjectId={id} />
          <VesselRequisitionsPanel dryDockProjectId={id} vesselId={vesselId} />
        </div>
      )}
    </PageShell>
  );
}
