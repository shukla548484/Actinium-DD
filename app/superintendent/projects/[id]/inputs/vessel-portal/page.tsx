"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselWorkspaceHub } from "@/components/superintendent/VesselWorkspaceHub";
import { useProjectVessel } from "@/components/superintendent/useProjectVessel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function VesselPortalPage() {
  const { id } = useParams<{ id: string }>();
  const { vessel, loading } = useProjectVessel(id);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel portal"
        description={
          vessel
            ? `${vessel.name} (${vessel.code}) — ship staff entry for dry dock preparation.`
            : "Complete onboard inputs and propose scope jobs for superintendent review."
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/superintendent/projects/${id}/inputs/review`} />}
            nativeButton={false}
          >
            Review queue
          </Button>
        }
      />

      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-3 text-sm">
          Use the sections below or open{" "}
          <Link href="/ship-access" className="font-medium underline">
            Ship Access
          </Link>{" "}
          for day-to-day onboard tasks. Proposed jobs integrate into the{" "}
          <Link href={`/superintendent/projects/${id}/scope`} className="font-medium underline">
            project scope
          </Link>{" "}
          after superintendent approval.
        </CardContent>
      </Card>

      {loading ? (
        <ActiniumLoadingState label="Loading vessel context…" size="sm" />
      ) : (
        <VesselWorkspaceHub dryDockProjectId={id} portal />
      )}
    </PageShell>
  );
}
