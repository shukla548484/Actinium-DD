import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ShipyardDashboardKpis } from "@/lib/shipyard/types";

const KPI_ITEMS: {
  key: keyof ShipyardDashboardKpis;
  label: string;
  nested?: "planned" | "actual" | "budgeted" | "workDone";
}[] = [
  { key: "totalJobs", label: "Total jobs" },
  { key: "jobsNotStarted", label: "Not started" },
  { key: "jobsInProgress", label: "In progress" },
  { key: "jobsCompleted", label: "Completed" },
  { key: "criticalPathJobs", label: "Critical path" },
  { key: "delayedJobs", label: "Delayed" },
  { key: "awaitingOwnerApproval", label: "Awaiting owner" },
  { key: "awaitingClassInspection", label: "Awaiting class" },
  { key: "awaitingMaterial", label: "Awaiting material" },
  { key: "awaitingAccessStaging", label: "Access / staging" },
  { key: "variationJobs", label: "Variation jobs" },
];

function kpiValue(kpis: ShipyardDashboardKpis, key: keyof ShipyardDashboardKpis): number {
  const v = kpis[key];
  if (typeof v === "number") return v;
  return 0;
}

export function ShipyardKpiGrid({ kpis }: { kpis: ShipyardDashboardKpis }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {KPI_ITEMS.map(({ key, label }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {kpiValue(kpis, key)}
              </CardTitle>
              <CardDescription>{label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tabular-nums">
              {kpis.plannedVsActualPct.planned}% planned · {kpis.plannedVsActualPct.actual}% actual
            </CardTitle>
            <CardDescription>Schedule health (planned vs actual progress)</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tabular-nums">
              {kpis.budgetedVsWorkDone.workDone}% of budget scope
            </CardTitle>
            <CardDescription>Commercial progress (work done vs budgeted)</CardDescription>
          </CardHeader>
        </Card>
        {kpis.activeProjects !== undefined ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.activeProjects}</CardTitle>
              <CardDescription>Active execution projects</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
