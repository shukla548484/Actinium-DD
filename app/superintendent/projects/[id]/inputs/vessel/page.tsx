"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselWorkspaceHub } from "@/components/superintendent/VesselWorkspaceHub";
import { useProjectVessel } from "@/components/superintendent/useProjectVessel";
import { Button } from "@/components/ui/button";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function VesselWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { vessel, loading } = useProjectVessel(id);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel"
        description={
          vessel
            ? `${vessel.name} (${vessel.code}) — onboard data feeding this dry dock project.`
            : "Onboard machinery, defects, jobs, and requisitions for dry dock preparation."
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/superintendent/projects/${id}/inputs/vessel-portal`} />}
              nativeButton={false}
            >
              Vessel portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/superintendent/projects/${id}/inputs/review`} />}
              nativeButton={false}
            >
              Review queue
            </Button>
          </>
        }
      />

      {loading ? (
        <ActiniumLoadingState label="Loading vessel context…" size="sm" />
      ) : (
        <VesselWorkspaceHub dryDockProjectId={id} />
      )}
    </PageShell>
  );
}
