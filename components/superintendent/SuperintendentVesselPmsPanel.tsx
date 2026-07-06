"use client";

import { useEffect, useState } from "react";
import { PmsSchedulePanel } from "@/components/shipAccess/PmsSchedulePanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export function SuperintendentVesselPmsPanel({ dryDockProjectId }: { dryDockProjectId: string }) {
  const [vesselId, setVesselId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${encodeURIComponent(dryDockProjectId)}`)
      .then((r) => r.json())
      .then((d: { project?: { vesselId?: string } }) => {
        if (d.project?.vesselId) setVesselId(d.project.vesselId);
        else setError("Project has no linked vessel.");
      })
      .catch(() => setError("Could not load project vessel."));
  }, [dryDockProjectId]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!vesselId) {
    return <ActiniumLoadingState label="Loading vessel PMS schedule…" size="sm" />;
  }

  return (
    <PmsSchedulePanel
      apiPath={`/api/superintendent/vessel-pms?vesselId=${encodeURIComponent(vesselId)}`}
    />
  );
}
