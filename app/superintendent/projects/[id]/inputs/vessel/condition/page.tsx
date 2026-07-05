"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function VesselConditionPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Condition reports"
        description="Hull, tank, machinery, and safety condition sections entered by ship staff before docking."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="vessel" />
    </PageShell>
  );
}
