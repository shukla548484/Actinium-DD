"use client";

import { Suspense, useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { SimpleJobForm } from "@/components/shipAccess/SimpleJobForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function useCrewSession() {
  const [defaultCreatedByName, setDefaultCreatedByName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { designation?: string | null; displayName?: string } | undefined;
        setDefaultCreatedByName(user?.designation ?? user?.displayName ?? "");
      });
  }, []);

  return { defaultCreatedByName };
}

function NewSimpleJobContent() {
  const ctx = useShipAccessContext();
  const crew = useCrewSession();

  return (
    <PageShell size="wide">
      <PageHeader
        title="New Job"
        description="Paint Jobs template — define prep by area and Sa grade (cost driver), then coating coats."
      />
      <SimpleJobForm
        vesselId={ctx.vesselId}
        readOnly={!ctx.vesselId}
        defaultCreatedByName={crew.defaultCreatedByName}
      />
    </PageShell>
  );
}

export default function NewSimpleJobPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <NewSimpleJobContent />
    </Suspense>
  );
}
