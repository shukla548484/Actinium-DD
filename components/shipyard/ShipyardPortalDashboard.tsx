"use client";

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
import { useShipyardLanguage } from "@/components/shipyard/ShipyardLanguageProvider";
import type { ShipyardPortalDashboard as DashboardData } from "@/lib/shipyard/portalDashboardTypes";
import { JOB_STATUS_LABELS } from "@/lib/shipyard/types";
import type { ShipyardQuoteUiKey } from "@/lib/i18n/shipyardQuotationUi";

const TOP_KPIS: {
  key: keyof Pick<
    DashboardData,
    | "currentProjects"
    | "projectsWaitingRfq"
    | "runningToday"
    | "delayedJobs"
    | "workersToday"
    | "equipmentUtilizationPct"
  >;
  labelKey: ShipyardQuoteUiKey;
  suffix?: string;
  href?: string;
}[] = [
  { key: "currentProjects", labelKey: "kpiCurrentProjects", href: "/shipyard/projects" },
  { key: "projectsWaitingRfq", labelKey: "kpiProjectsWaitingRfq", href: "/shipyard/rfq" },
  { key: "runningToday", labelKey: "kpiRunningToday" },
  { key: "delayedJobs", labelKey: "kpiDelayedJobs" },
  { key: "workersToday", labelKey: "kpiWorkersToday" },
  { key: "equipmentUtilizationPct", labelKey: "kpiEquipmentUtilization", suffix: "%" },
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

export function ShipyardPortalDashboard({ data }: { data: DashboardData }) {
  const { t, label } = useShipyardLanguage();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TOP_KPIS.map(({ key, labelKey, suffix, href }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {data[key]}
                {suffix ?? ""}
              </CardTitle>
              <CardDescription>
                {href ? (
                  <Link href={href} className="text-primary hover:underline">
                    {label(labelKey)}
                  </Link>
                ) : (
                  label(labelKey)
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
            <CardTitle>{label("projectsTimeline")}</CardTitle>
            <CardDescription>{label("projectsTimelineDesc")}</CardDescription>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            {data.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noScheduledProjects")}</p>
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
            <CardTitle>{label("criticalJobsToday")}</CardTitle>
            <CardDescription>{label("criticalJobsTodayDesc")}</CardDescription>
          </CardHeader>
          <div className="space-y-2 px-6 pb-6">
            {data.criticalJobsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noCriticalJobs")}</p>
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
          <CardTitle>{label("projectProgress")}</CardTitle>
          <CardDescription>{label("projectProgressDesc")}</CardDescription>
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          {data.projectProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noExecutionProjectsPrefix")}{" "}
              <Link href="/shipyard/awarded" className="text-primary hover:underline">
                {t("awardedProjects")}
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
                  {p.vesselName ?? "—"} · {t("jobsCount").replace("{n}", String(p.jobCount))}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{label("variationOrders")}</CardTitle>
            <CardDescription>{label("variationOrdersDesc")}</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.pending}</p>
              <p className="text-xs text-muted-foreground">{label("pending")}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.approved}</p>
              <p className="text-xs text-muted-foreground">{label("approved")}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.variationSummary.rejected}</p>
              <p className="text-xs text-muted-foreground">{label("rejected")}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{label("invoices")}</CardTitle>
            <CardDescription>{label("invoicesDesc")}</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.pending}</p>
              <p className="text-xs text-muted-foreground">{label("pending")}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.paid}</p>
              <p className="text-xs text-muted-foreground">{label("paid")}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{data.invoiceSummary.overdue}</p>
              <p className="text-xs text-muted-foreground">{label("overdue")}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link href="/shipyard/rfq" />} nativeButton={false}>
          {label("rfqInbox")}
        </Button>
        <Button variant="outline" render={<Link href="/shipyard/profile" />} nativeButton={false}>
          {label("yardProfile")}
        </Button>
        <Button variant="outline" render={<Link href="/shipyard/execution/progress" />} nativeButton={false}>
          {label("dailyProgress")}
        </Button>
      </div>
    </div>
  );
}
