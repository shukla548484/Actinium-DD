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
      queueMicrotask(() => setDefectPrefill(null));
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
    <PageShell size="full" className="bg-slate-50">
      <PageHeader
        title="Create New Dry Dock Job"
        description="Define job details, requirements, attachments, and scope for dry dock planning and execution."
        showBack={false}
      />
      {ctx.vesselId ? (
        <DynamicScopeJobWizard
          vesselId={ctx.vesselId}
          vesselName={ctx.vessel?.name}
          vesselCode={ctx.vessel?.code}
          dryDockProjectId={ctx.dryDockProject?.id}
          dryDockProjectName={ctx.dryDockProject?.name}
          dryDockProjectReference={ctx.dryDockProject?.referenceCode}
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
