"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselJobBankPanel } from "@/components/superintendent/VesselJobBankPanel";
import { VesselProjectJobsPanel } from "@/components/superintendent/VesselProjectJobsPanel";
import { useProjectVessel } from "@/components/superintendent/useProjectVessel";

export default function VesselJobsPage() {
  const { id } = useParams<{ id: string }>();
  const { vesselId, loading } = useProjectVessel(id);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel dry dock jobs"
        description="Ship-proposed scope jobs. Approve and integrate selected items into the project job library."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <VesselJobBankPanel dryDockProjectId={id} />
          <VesselProjectJobsPanel dryDockProjectId={id} vesselId={vesselId} />
        </div>
      )}
    </PageShell>
  );
}
