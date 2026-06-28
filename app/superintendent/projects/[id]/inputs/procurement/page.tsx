"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";

export default function ProcurementInputsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Procurement inputs"
        description="Required spares, onboard availability, delivery tracking, and RFQ terms."
      />
      <ProjectInputsPanel dryDockProjectId={id} pageKey="procurement" />
    </PageShell>
  );
}
