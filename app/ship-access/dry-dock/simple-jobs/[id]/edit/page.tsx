"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { SimpleJobForm } from "@/components/shipAccess/SimpleJobForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { DdSimpleJobDto } from "@/lib/dryDockJobs/types";

function EditSimpleJobContent() {
  const params = useParams<{ id: string }>();
  const ctx = useShipAccessContext();
  const [job, setJob] = useState<DdSimpleJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ship-access/simple-jobs/${params.id}`);
        const data = (await res.json()) as { job?: DdSimpleJobDto; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load job");
          setJob(null);
          return;
        }
        setJob(data.job ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return <ActiniumLoadingState label="Loading job…" size="md" minHeight={140} />;
  }

  if (error || !job) {
    return (
      <PageShell>
        <PageHeader title="Edit Job" />
        <p className="text-sm text-destructive">{error ?? "Job not found"}</p>
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <PageHeader title="Edit Job" description={job.title} />
      <SimpleJobForm vesselId={ctx.vesselId ?? job.vesselId} initial={job} />
    </PageShell>
  );
}

export default function EditSimpleJobPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <EditSimpleJobContent />
    </Suspense>
  );
}
