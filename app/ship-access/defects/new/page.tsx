"use client";

import { Suspense } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { DefectSubmitForm } from "@/components/shipAccess/DefectSubmitForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { useEffect, useState } from "react";

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

function ShipAccessNewDefectContent() {
  const ctx = useShipAccessContext();
  const crew = useCrewSession();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Report defect"
        description="Identify the affected machinery or system, then describe the defect for Master review."
      />
      <DefectSubmitForm
        vesselId={ctx.vesselId}
        readOnly={!ctx.vesselId}
        defaultReportedByName={crew.defaultReportedByName}
      />
    </PageShell>
  );
}

export default function ShipAccessNewDefectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <ShipAccessNewDefectContent />
    </Suspense>
  );
}
