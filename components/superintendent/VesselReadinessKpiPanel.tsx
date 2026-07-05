"use client";

import { fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import type { VesselDryDockReadinessDto } from "@/lib/db/vesselReadiness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  readiness: VesselDryDockReadinessDto;
  compact?: boolean;
};

export function VesselReadinessKpiPanel({ readiness, compact }: Props) {
  const kpis = [
    { label: "Dry dock readiness", value: fmtPct(readiness.readinessPct), highlight: true },
    { label: "Jobs proposed", value: String(readiness.jobsProposed) },
    { label: "Jobs approved", value: String(readiness.jobsApproved) },
    { label: "Integrated to scope", value: String(readiness.jobsIntegrated) },
    { label: "Pending CE review", value: String(readiness.jobsPendingReview) },
    { label: "Critical jobs", value: String(readiness.criticalJobs) },
    { label: "Photos / attachments", value: String(readiness.photosUploaded) },
    { label: "Measurements", value: String(readiness.measurementsCount) },
    { label: "Est. budget", value: fmtMoney(readiness.estimatedBudget) },
    { label: "PMS jobs linked", value: String(readiness.pmsJobsLinked) },
    { label: "Defects linked", value: String(readiness.defectsLinked) },
    { label: "Machinery health", value: readiness.machineryHealthScore != null ? fmtPct(readiness.machineryHealthScore) : "—" },
    { label: "Overdue maintenance", value: String(readiness.overdueMaintenanceCount) },
  ];

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dry dock readiness</CardTitle>
          <CardDescription>
            {readiness.jobsApproved} approved · {readiness.jobsPendingReview} pending ·{" "}
            {readiness.jobsIntegrated} in scope
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{fmtPct(readiness.readinessPct)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="pb-2">
            <CardTitle
              className={`tabular-nums ${kpi.highlight ? "text-2xl font-bold" : "text-lg font-semibold"}`}
            >
              {kpi.value}
            </CardTitle>
            <CardDescription>{kpi.label}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
