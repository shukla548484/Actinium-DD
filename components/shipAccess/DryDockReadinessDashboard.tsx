"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import type { VesselDryDockReadinessDto } from "@/lib/db/vesselReadiness";

type Props = {
  vesselId: string | null;
  dryDockProjectId?: string | null;
};

export function DryDockReadinessDashboard({ vesselId, dryDockProjectId }: Props) {
  const [data, setData] = useState<VesselDryDockReadinessDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);

  const loadReadiness = async () => {
    if (!vesselId) return;
    const params = new URLSearchParams({ vesselId });
    if (dryDockProjectId) params.set("dryDockProjectId", dryDockProjectId);
    const r = await fetch(`/api/ship-access/dry-dock/readiness?${params}`);
    const d = (await r.json()) as { readiness?: VesselDryDockReadinessDto };
    setData(d.readiness ?? null);
  };

  useEffect(() => {
    if (!vesselId) {
      setLoading(false);
      return;
    }
    void loadReadiness().finally(() => setLoading(false));
  }, [vesselId, dryDockProjectId]);

  async function handleProposeOverdue() {
    if (!vesselId) return;
    setProposing(true);
    setProposeMsg(null);
    try {
      const res = await fetch("/api/ship-access/machinery/propose-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vesselId, dryDockProjectId }),
      });
      const body = (await res.json()) as { proposed?: number; error?: string };
      if (!res.ok) {
        setProposeMsg(body.error ?? "Could not propose overdue jobs.");
        return;
      }
      setProposeMsg(
        body.proposed
          ? `Created ${body.proposed} draft job${body.proposed === 1 ? "" : "s"} from overdue PMS.`
          : "No new overdue maintenance jobs to propose.",
      );
      await loadReadiness();
    } finally {
      setProposing(false);
    }
  }

  if (!vesselId) {
    return <p className="text-sm text-muted-foreground">Select a vessel to view readiness.</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading dry dock readiness…</p>;
  }

  if (!data) return null;

  const kpis = [
    { label: "Dry dock readiness", value: fmtPct(data.readinessPct), highlight: true },
    { label: "Jobs proposed", value: String(data.jobsProposed) },
    { label: "Jobs approved", value: String(data.jobsApproved) },
    { label: "Integrated to scope", value: String(data.jobsIntegrated) },
    { label: "Pending review", value: String(data.jobsPendingReview) },
    { label: "Critical jobs", value: String(data.criticalJobs) },
    { label: "Overdue maintenance", value: String(data.overdueMaintenanceCount) },
    { label: "Photos uploaded", value: String(data.photosUploaded) },
    { label: "Measurements", value: String(data.measurementsCount) },
    { label: "Estimated budget", value: fmtMoney(data.estimatedBudget) },
    { label: "PMS jobs linked", value: String(data.pmsJobsLinked) },
    { label: "Defects linked", value: String(data.defectsLinked) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle
                className={`tabular-nums ${kpi.highlight ? "text-3xl font-bold" : "text-xl font-semibold"}`}
              >
                {kpi.value}
              </CardTitle>
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {proposeMsg ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm">{proposeMsg}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/ship-access/dry-dock/jobs/new" />} nativeButton={false}>
          Add dry dock job
        </Button>
        <Button
          variant="outline"
          render={<Link href="/ship-access/dry-dock/jobs" />}
          nativeButton={false}
        >
          View proposed jobs
        </Button>
        <Button
          variant="outline"
          render={<Link href="/ship-access/machinery" />}
          nativeButton={false}
        >
          Machinery dashboard
        </Button>
        {data.overdueMaintenanceCount > 0 ? (
          <Button variant="secondary" disabled={proposing} onClick={() => void handleProposeOverdue()}>
            {proposing ? "Proposing…" : "Propose overdue PMS jobs"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
