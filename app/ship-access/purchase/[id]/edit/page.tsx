"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { RequisitionSubmitForm } from "@/components/shipAccess/RequisitionSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

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

function ShipAccessEditRequisitionContent() {
  const params = useParams<{ id: string }>();
  const ctx = useShipAccessContext();
  const crew = useCrewSession();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Update requisition"
        description="Edit a draft or rejected spares requisition before resubmitting for Master approval."
      />
      <RequisitionSubmitForm
        requisitionId={params.id}
        vesselId={ctx.vesselId}
        dryDockProjectId={ctx.dryDockProject?.id ?? null}
        readOnly={!ctx.vesselId}
        defaultRequestedByName={crew.defaultRequestedByName}
      />
    </PageShell>
  );
}

export default function ShipAccessEditRequisitionPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <ShipAccessEditRequisitionContent />
    </Suspense>
  );
}
