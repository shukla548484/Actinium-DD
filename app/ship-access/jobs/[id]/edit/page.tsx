"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { VesselJobSubmitForm } from "@/components/superintendent/VesselJobSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function useCrewSession() {
  const [allowedJobCategories, setAllowedJobCategories] = useState<string[]>([]);
  const [defaultCreatedByName, setDefaultCreatedByName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as {
          allowedJobCategories?: string[];
          designation?: string | null;
          displayName?: string;
        } | undefined;
        setAllowedJobCategories(user?.allowedJobCategories ?? []);
        setDefaultCreatedByName(user?.designation ?? user?.displayName ?? "");
      });
  }, []);

  return { allowedJobCategories, defaultCreatedByName };
}

function ShipAccessEditJobContent() {
  const params = useParams<{ id: string }>();
  const ctx = useShipAccessContext();
  const crew = useCrewSession();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Update job"
        description="Revise job details and resubmit to the superintendent job bank when ready."
      />
      <VesselJobSubmitForm
        jobId={params.id}
        dryDockProjectId={ctx.dryDockProject?.id ?? ""}
        vesselId={ctx.vesselId}
        jobsApiBase="/api/ship-access/jobs"
        readOnly={!ctx.vesselId}
        allowedCategories={crew.allowedJobCategories}
        defaultCreatedByName={crew.defaultCreatedByName}
      />
    </PageShell>
  );
}

export default function ShipAccessEditJobPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <ShipAccessEditJobContent />
    </Suspense>
  );
}
