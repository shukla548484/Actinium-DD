import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { getShipyardDashboardKpis } from "@/lib/db/yardExecution";

export const dynamic = "force-dynamic";

export default async function ShipyardReportsPage() {
  const kpis = await getShipyardDashboardKpis();

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Export execution KPIs, delay analysis, workshop productivity, and final completion summaries."
      />
      <div className="rounded-lg border p-6 text-sm">
        <p className="mb-4 text-muted-foreground">
          Report templates will aggregate workshop jobs, delays, and commercial progress.
        </p>
        <ul className="space-y-1 tabular-nums">
          <li>Total jobs: {kpis.totalJobs}</li>
          <li>Completed: {kpis.jobsCompleted}</li>
          <li>Delayed: {kpis.delayedJobs}</li>
          <li>Schedule health: {kpis.plannedVsActualPct.actual}% actual vs {kpis.plannedVsActualPct.planned}% planned</li>
        </ul>
      </div>
    </PageShell>
  );
}
