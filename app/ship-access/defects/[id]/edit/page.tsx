"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { DefectSubmitForm } from "@/components/shipAccess/DefectSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

function useCrewSession() {
  const [defaultReportedByName, setDefaultReportedByName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { designation?: string | null; displayName?: string } | undefined;
        setDefaultReportedByName(user?.designation ?? user?.displayName ?? "");
      });
  }, []);

  return { defaultReportedByName };
}

function ShipAccessEditDefectContent() {
  const params = useParams<{ id: string }>();
  const ctx = useShipAccessContext();
  const crew = useCrewSession();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Update defect"
        description="Edit a draft or rejected defect before resubmitting for Master approval."
      />
      <DefectSubmitForm
        defectId={params.id}
        vesselId={ctx.vesselId}
        readOnly={!ctx.vesselId}
        defaultReportedByName={crew.defaultReportedByName}
      />
    </PageShell>
  );
}

export default function ShipAccessEditDefectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <ShipAccessEditDefectContent />
    </Suspense>
  );
}
