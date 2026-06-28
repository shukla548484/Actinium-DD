"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function VesselInputsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel pre-docking inputs"
        description="Complete mandatory sections before dry dock. Submit each section for superintendent review."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="vessel" />
    </PageShell>
  );
}
