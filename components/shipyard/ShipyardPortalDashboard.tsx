import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShipyardKpiGrid } from "@/components/shipyard/ShipyardKpiGrid";
import type { ShipyardPortalDashboard } from "@/lib/shipyard/portalDashboardTypes";
import { JOB_STATUS_LABELS } from "@/lib/shipyard/types";

const TOP_KPIS: {
  key: keyof Pick<
    ShipyardPortalDashboard,
    | "currentProjects"
    | "projectsWaitingRfq"
    | "runningToday"
    | "delayedJobs"
    | "workersToday"
    | "equipmentUtilizationPct"
  >;
  label: string;
  suffix?: string;
  href?: string;
}[] = [
  { key: "currentProjects", label: "Current projects", href: "/shipyard/projects" },
  { key: "projectsWaitingRfq", label: "Projects waiting RFQ", href: "/shipyard/rfq" },
  { key: "runningToday", label: "Running today" },
  { key: "delayedJobs", label: "Delayed jobs" },
  { key: "workersToday", label: "Workers today" },
  { key: "equipmentUtilizationPct", label: "Equipment utilization", suffix: "%" },
];

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function ShipyardPortalDashboard({ data }: { data: ShipyardPortalDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TOP_KPIS.map(({ key, label, suffix, href }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {data[key]}
                {suffix ?? ""}
              </CardTitle>
              <CardDescription>
                {href ? (
                  <Link href={href} className="text-primary hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <ShipyardKpiGrid kpis={data.executionKpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects timeline</CardTitle>
            <CardDescription>Planned start and finish for active execution projects</CardDescription>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            {data.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled projects yet.</p>
            ) : (
              data.timeline.map((item) => (
                <div key={item.projectId} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.projectName}</p>
                      <p className="text-xs text-muted-foreground">{item.vesselName ?? "—"}</p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.plannedStart
                      ? new Date(item.plannedStart).toLocaleDateString()
                      : "TBD"}{" "}
                    →{" "}
                    {item.plannedFinish
                      ? new Date(item.plannedFinish).toLocaleDateString()
                      : "TBD"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s critical jobs</CardTitle>
            <CardDescription>Critical path items due or active today</CardDescription>
          </CardHeader>
          <div className="space-y-2 px-6 pb-6">
            {data.criticalJobsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical jobs flagged for today.</p>
            ) : (
              data.criticalJobsToday.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.jobTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.projectName} · {job.workshopName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="secondary">
                      {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}
                    </Badge>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">{job.progressPct}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project progress</CardTitle>
          <CardDescription>Average job completion by execution project</CardDescription>
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          {data.projectProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Initialize execution from{" "}
              <Link href="/shipyard/awarded" className="text-primary hover:underline">
                Awarded projects
              </Link>
              .
            </p>
          ) : (
            data.projectProgress.map((p) => (
              <div key={p.projectId} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{p.projectName}</span>
                  <span className="tabular-nums text-muted-foreground">{p.progressPct}%</span>
                </div>
                <ProgressBar value={p.progressPct} />
                <p className="text-xs text-muted-foreground">
                  {p.vesselName ?? "—"} · {p.jobCount} job(s)
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Variation orders</CardTitle>
            <CardDescription>Commercial change register summary</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Dry dock billing register (office-linked)</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.paid}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link href="/shipyard/rfq" />} nativeButton={false}>
          RFQ inbox
        </Button>
        <Button variant="outline" render={<Link href="/shipyard/profile" />} nativeButton={false}>
          Yard profile
        </Button>
        <Button variant="outline" render={<Link href="/shipyard/execution/progress" />} nativeButton={false}>
          Daily progress
        </Button>
      </div>
    </div>
  );
}
