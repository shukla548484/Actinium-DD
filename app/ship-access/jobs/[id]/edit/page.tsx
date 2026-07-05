"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { VesselJobSubmitForm } from "@/components/superintendent/VesselJobSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

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
        title="Update draft job"
        description="Edit a draft job before submitting it to the superintendent job bank."
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
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <ShipAccessEditJobContent />
    </Suspense>
  );
}
