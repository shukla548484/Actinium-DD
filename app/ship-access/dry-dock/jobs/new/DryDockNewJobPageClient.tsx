"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import {
  DynamicScopeJobWizard,
  type DefectJobPrefill,
} from "@/components/shipAccess/DynamicScopeJobWizard";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import type { VesselDefectDto } from "@/lib/shipAccess/defectTypes";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function DryDockNewJobPageClient() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const defectId = searchParams.get("defectId");
  const [createdByName, setCreatedByName] = useState("");
  const [defectPrefill, setDefectPrefill] = useState<DefectJobPrefill | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { displayName?: string; vesselLoginId?: string } | undefined;
        setCreatedByName(user?.displayName ?? user?.vesselLoginId ?? "");
      });
  }, []);

  useEffect(() => {
    if (!defectId || !ctx.vesselId) {
      setDefectPrefill(null);
      return;
    }
    void fetch(`/api/ship-access/defects/${defectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const defect = data?.defect as VesselDefectDto | undefined;
        if (!defect || defect.status !== "master_approved") {
          setDefectPrefill(null);
          return;
        }
        setDefectPrefill({
          id: defect.id,
          title: defect.title,
          description: defect.description,
          equipmentLabel: defect.equipmentLabel,
          priority: defect.priority,
        });
      });
  }, [defectId, ctx.vesselId]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Add dry dock job"
        description="Select from the master job library — department, system, machinery, component, and standard job."
      />
      {ctx.vesselId ? (
        <DynamicScopeJobWizard
          vesselId={ctx.vesselId}
          dryDockProjectId={ctx.dryDockProject?.id}
          linkedDefectId={defectPrefill?.id ?? defectId}
          defectPrefill={defectPrefill}
          createdByName={createdByName}
          jobsApiBase="/api/ship-access/jobs"
        />
      ) : (
        <ActiniumLoadingState label="Loading vessel context…" size="sm" />
      )}
    </PageShell>
  );
}
