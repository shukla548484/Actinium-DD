"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";
import { VesselJobSubmitForm } from "@/components/superintendent/VesselJobSubmitForm";
import { Card, CardContent } from "@/components/ui/card";

export default function VesselInputPortalPage() {
  const { id } = useParams<{ id: string }>();
  const [vesselId, setVesselId] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d.project as { vesselId?: string } | undefined;
        if (p?.vesselId) setVesselId(p.vesselId);
      });
  }, [id]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel pre-docking inputs"
        description="Ship staff entry — complete condition reports and submit for superintendent review."
      />
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-3 text-sm">
          Complete each section and use <strong>Submit for review</strong> when ready. The
          superintendent will approve items in the{" "}
          <Link href={`/superintendent/projects/${id}/inputs/review`} className="underline">
            review queue
          </Link>
          .           Proposed scope jobs go to{" "}
          <Link href="/ship-access/jobs/new" className="underline">
            Ship Access
          </Link>{" "}
          or the{" "}
          <Link href="/superintendent/vessel-jobs" className="underline">
            vessel job bank
          </Link>{" "}
          for superintendent curation.
        </CardContent>
      </Card>
      <div className="mb-8">
        <VesselJobSubmitForm dryDockProjectId={id} vesselId={vesselId} />
      </div>
      <ProjectInputsPanel dryDockProjectId={id} pageKey="vessel" enteredByRole="vessel" />
    </PageShell>
  );
}
