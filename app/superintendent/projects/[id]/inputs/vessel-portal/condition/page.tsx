"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ProjectInputsPanel } from "@/components/superintendent/ProjectInputsPanel";
import { Card, CardContent } from "@/components/ui/card";

export default function VesselPortalConditionPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Condition reports"
        description="Complete each section and submit for superintendent review when ready."
      />
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-3 text-sm">
          The superintendent reviews submissions in the{" "}
          <Link href={`/superintendent/projects/${id}/inputs/review`} className="underline">
            review queue
          </Link>
          .
        </CardContent>
      </Card>
      <ProjectInputsPanel dryDockProjectId={id} pageKey="vessel" enteredByRole="vessel" />
    </PageShell>
  );
}
