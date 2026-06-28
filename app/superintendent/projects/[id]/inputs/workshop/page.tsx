"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function WorkshopInputsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Shipyard / workshop inputs"
        description="Work plan, resources, progress updates, and yard assessment reports."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="workshop" enteredByRole="shipyard" />
    </PageShell>
  );
}
