"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPct } from "@/lib/superintendent/formatters";
import {
  VESSEL_WORKSPACE_NAV,
  vesselWorkspaceHref,
} from "@/lib/superintendent/vesselWorkspaceNav";
import type { InputReadinessReport } from "@/lib/db/superintendent/inputs";
import type { VesselDryDockReadinessDto } from "@/lib/db/vesselReadiness";
import { VesselReadinessKpiPanel } from "@/components/superintendent/VesselReadinessKpiPanel";

type Props = {
  dryDockProjectId: string;
  portal?: boolean;
};

type SummaryCounts = {
  defects: number;
  masterApprovedDefects: number;
  jobs: number;
  pendingJobs: number;
  requisitions: number;
  approvedRequisitions: number;
  hasMachineryHours: boolean;
};

export function VesselWorkspaceHub({ dryDockProjectId, portal }: Props) {
  const [readiness, setReadiness] = useState<InputReadinessReport | null>(null);
  const [ddReadiness, setDdReadiness] = useState<VesselDryDockReadinessDto | null>(null);
  const [counts, setCounts] = useState<SummaryCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      fetch(`/api/superintendent/projects/${dryDockProjectId}/inputs/readiness?pageKey=vessel`)
        .then((r) => r.json())
        .then((d: { readiness?: InputReadinessReport }) => setReadiness(d.readiness ?? null)),
      !portal
        ? fetch(`/api/superintendent/projects/${dryDockProjectId}/vessel-readiness`)
            .then((r) => r.json())
            .then((d: { readiness?: VesselDryDockReadinessDto }) => setDdReadiness(d.readiness ?? null))
        : Promise.resolve(),
      fetch(`/api/superintendent/projects/${dryDockProjectId}`)
        .then((r) => r.json())
        .then(async (d) => {
          const vesselId = (d.project as { vessel?: { id: string } } | undefined)?.vessel?.id;
          if (!vesselId) {
            setCounts(null);
            return;
          }

          const [defectsRes, jobsRes, reqRes, hoursRes] = await Promise.all([
            fetch(`/api/superintendent/vessel-defects?vesselId=${vesselId}&limit=200`),
            fetch(`/api/superintendent/vessel-jobs?vesselId=${vesselId}&limit=200`),
            fetch(`/api/superintendent/vessel-requisitions?vesselId=${vesselId}&limit=200`),
            fetch(`/api/superintendent/vessel-machinery-hours?vesselId=${vesselId}`),
          ]);

          const defectsData = (await defectsRes.json()) as { defects?: { status: string }[] };
          const jobsData = (await jobsRes.json()) as { vesselJobs?: { status: string }[] };
          const reqData = (await reqRes.json()) as { requisitions?: { status: string }[] };
          const hoursData = (await hoursRes.json()) as {
            hours?: {
              mainEngineRunningHours: number | null;
              auxiliaryEngineRunningHours: number | null;
              boilerRunningHours: number | null;
            };
          };

          const defects = defectsData.defects ?? [];
          const jobs = jobsData.vesselJobs ?? [];
          const requisitions = reqData.requisitions ?? [];
          const hours = hoursData.hours;

          setCounts({
            defects: defects.length,
            masterApprovedDefects: defects.filter((x) => x.status === "master_approved").length,
            jobs: jobs.length,
            pendingJobs: jobs.filter((x) =>
              ["submitted", "approved", "carry_forward"].includes(x.status),
            ).length,
            requisitions: requisitions.length,
            approvedRequisitions: requisitions.filter((x) => x.status === "master_approved").length,
            hasMachineryHours: Boolean(
              hours?.mainEngineRunningHours != null ||
                hours?.auxiliaryEngineRunningHours != null ||
                hours?.boilerRunningHours != null,
            ),
          });
        }),
    ]).finally(() => setLoading(false));
  }, [dryDockProjectId]);

  const sections = VESSEL_WORKSPACE_NAV.filter((item) => item.segment !== "overview");

  return (
    <div className="space-y-6">
      {!portal && ddReadiness ? <VesselReadinessKpiPanel readiness={ddReadiness} /> : null}

      {readiness ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Condition report readiness</CardTitle>
              <CardDescription>
                {readiness.completedSections}/{readiness.totalSections} sections complete ·{" "}
                {readiness.pendingReview} pending superintendent review
              </CardDescription>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmtPct(readiness.completionPct)}</p>
          </CardHeader>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading vessel summary…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => {
            const Icon = item.icon;
            const href = vesselWorkspaceHref(dryDockProjectId, item.segment, portal);
            const shipHref = item.shipAccessHref;

            let stat: string | null = null;
            if (counts) {
              if (item.segment === "defects") {
                stat = `${counts.defects} reported · ${counts.masterApprovedDefects} Master-approved`;
              } else if (item.segment === "jobs") {
                stat = `${counts.jobs} total · ${counts.pendingJobs} awaiting integration`;
              } else if (item.segment === "requisitions") {
                stat = `${counts.requisitions} total · ${counts.approvedRequisitions} ready for spares`;
              } else if (item.segment === "machinery") {
                stat = counts.hasMachineryHours ? "Running hours recorded" : "Not updated yet";
              } else if (item.segment === "condition") {
                stat = readiness
                  ? `${readiness.completedSections}/${readiness.totalSections} sections`
                  : null;
              }
            }

            return (
              <Card key={item.segment} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                  {stat ? <p className="text-xs text-muted-foreground">{stat}</p> : null}
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={href} />}
                    nativeButton={false}
                  >
                    {portal ? "Open" : "Manage"}
                  </Button>
                  {portal && shipHref ? (
                    <Button size="sm" render={<Link href={shipHref} />} nativeButton={false}>
                      Ship Access
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!portal ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm">
            Vessel-proposed jobs integrate into{" "}
            <Link
              href={`/superintendent/projects/${dryDockProjectId}/scope`}
              className="font-medium underline"
            >
              project scope
            </Link>
            . Master-approved requisitions convert to spares from the{" "}
            <Link
              href={`/superintendent/projects/${dryDockProjectId}/inputs/vessel/requisitions`}
              className="font-medium underline"
            >
              requisitions
            </Link>{" "}
            or{" "}
            <Link
              href={`/superintendent/projects/${dryDockProjectId}/procurement`}
              className="font-medium underline"
            >
              procurement
            </Link>{" "}
            modules.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
