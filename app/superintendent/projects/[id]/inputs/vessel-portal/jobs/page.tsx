"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { DynamicScopeJobWizard } from "@/components/shipAccess/DynamicScopeJobWizard";
import { useProjectVessel } from "@/components/superintendent/useProjectVessel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function VesselPortalJobsPage() {
  const { id } = useParams<{ id: string }>();
  const { vesselId, loading } = useProjectVessel(id);
  const [createdByName, setCreatedByName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { designation?: string | null; displayName?: string } | undefined;
        setCreatedByName(user?.designation ?? user?.displayName ?? "");
      });
  }, []);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Propose dry dock jobs"
        description="Select from the master job library and complete the dynamic scope form."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/ship-access/dry-dock/jobs" />}
            nativeButton={false}
          >
            View all in Ship Access
          </Button>
        }
      />

      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-3 text-sm">
          Approved jobs integrate into project scope. Track status in{" "}
          <Link href="/ship-access/dry-dock/jobs" className="underline">
            Ship Access → Dry dock jobs
          </Link>
          .
        </CardContent>
      </Card>

      {loading ? (
        <ActiniumLoadingState size="sm" />
      ) : vesselId ? (
        <DynamicScopeJobWizard
          vesselId={vesselId}
          dryDockProjectId={id}
          createdByName={createdByName}
          jobsApiBase="/api/ship-access/jobs"
          jobLibraryApiBase="/api/superintendent/job-library"
        />
      ) : (
        <p className="text-sm text-muted-foreground">No vessel linked to this project.</p>
      )}
    </PageShell>
  );
}
