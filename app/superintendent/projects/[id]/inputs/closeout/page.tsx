"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function CloseoutInputsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Closeout inputs"
        description="Completion evidence, QA/QC, class approval, warranty, and commercial closeout."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="closeout" />
    </PageShell>
  );
}
