"use client";

import { useState } from "react";
import { DryDockProjectCreateForm } from "@/components/superintendent/DryDockProjectCreateForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  const [vesselId, setVesselId] = useState("");

  return (
    <PageShell>
      <PageHeader title="New dry dock project" description="Create a dry dock execution project." />

      <DryDockProjectCreateForm
        vesselId={vesselId}
        onVesselIdChange={setVesselId}
        successHref="/superintendent/projects"
      />
    </PageShell>
  );
}
