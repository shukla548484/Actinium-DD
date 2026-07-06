"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { RequisitionSubmitForm } from "@/components/shipAccess/RequisitionSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function useCrewSession() {
  const [defaultRequestedByName, setDefaultRequestedByName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { designation?: string | null; displayName?: string } | undefined;
        setDefaultRequestedByName(user?.designation ?? user?.displayName ?? "");
      });
  }, []);

  return { defaultRequestedByName };
}

function ShipAccessNewRequisitionContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const crew = useCrewSession();
  const defectId = searchParams.get("defectId");

  return (
    <PageShell size="wide">
      <PageHeader
        title="New spares requisition"
        description="Select a Master-approved defect and add spares line items for procurement."
      />
      <RequisitionSubmitForm
        vesselId={ctx.vesselId}
        dryDockProjectId={ctx.dryDockProject?.id ?? null}
        readOnly={!ctx.vesselId}
        defaultRequestedByName={crew.defaultRequestedByName}
        initialDefectId={defectId}
      />
    </PageShell>
  );
}

export default function ShipAccessNewRequisitionPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <ShipAccessNewRequisitionContent />
    </Suspense>
  );
}
