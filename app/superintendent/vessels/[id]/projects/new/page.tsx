"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DryDockProjectCreateForm } from "@/components/superintendent/DryDockProjectCreateForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

type VesselSummary = { id: string; code: string; name: string };

export default function VesselNewProjectPage() {
  const { id: vesselId } = useParams<{ id: string }>();
  const [vessel, setVessel] = useState<VesselSummary | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/vessels/${vesselId}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.vessel as VesselSummary | undefined;
        if (v) setVessel({ id: v.id, code: v.code, name: v.name });
      });
  }, [vesselId]);

  return (
    <PageShell>
      <PageHeader
        title="Create dry dock project"
        description={
          vessel
            ? `New project for ${vessel.name} (${vessel.code})`
            : "Create a dry dock execution project for this vessel."
        }
      />

      <DryDockProjectCreateForm
        vesselId={vesselId}
        vesselReadonly={vessel}
        cancelFallbackHref={`/superintendent/vessels/${vesselId}/projects`}
        successHref={`/superintendent/vessels/${vesselId}/projects`}
      />
    </PageShell>
  );
}
