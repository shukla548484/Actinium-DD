"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function SuperintendentInputsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Superintendent inputs"
        description="Scope approval, budget plan, survey planning, and technical decisions."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="superintendent" />
    </PageShell>
  );
}
