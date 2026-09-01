"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselJobBankPanel } from "@/components/superintendent/VesselJobBankPanel";
import { VesselScopeIntegrationBanner } from "@/components/superintendent/VesselScopeIntegrationBanner";
import { fmtMoney, displayYardProgress } from "@/lib/superintendent/formatters";
import { isPaintingInputJob } from "@/lib/superintendent/paintingScopeJobs";
import { formatJobScopePreview, jobScopeIsDefined } from "@/lib/superintendent/scopeJobPreview";
import { isSeaValveInputJob } from "@/lib/superintendent/seaValveScopeJobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  jobCode: string | null;
  title: string;
  category: string;
  description: string | null;
  workshop: string | null;
  status: string;
  priority: string;
  progressPct: number | null;
  budgetAmount: number | null;
};

export default function ProjectScopePage() {
  const { id } = useParams<{ id: string }>();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(() => {
    setLoading(true);
    void fetch(`/api/superintendent/jobs?dryDockProjectId=${encodeURIComponent(id)}&limit=100`)
      .then((r) => r.json())
      .then((d: { items?: JobRow[] }) => setJobs(d.items ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Scope of work"
        description="Job library for this dry dock project."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/superintendent/jobs/import?dryDockProjectId=${encodeURIComponent(id)}`}
                />
              }
              nativeButton={false}
            >
              Import Excel
            </Button>
            <Button
              size="sm"
              render={
                <Link href={`/superintendent/jobs/new?dryDockProjectId=${encodeURIComponent(id)}`} />
              }
              nativeButton={false}
            >
              Add job
            </Button>
          </>
        }
      />
      <VesselScopeIntegrationBanner dryDockProjectId={id} />
      <div className="mb-4">
        <VesselJobBankPanel dryDockProjectId={id} onIntegrated={loadJobs} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <ActiniumLoadingState label="Loading scope…" size="md" minHeight={100} />
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[14%]">Title</TableHead>
                  <TableHead className="w-[8%]">Category</TableHead>
                  <TableHead className="w-[8%]">Workshop</TableHead>
                  <TableHead className="w-[34%]">Scope summary</TableHead>
                  <TableHead className="w-[8%]">Priority</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[10%]">Yard progress</TableHead>
                  <TableHead className="w-[8%]">Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No jobs in scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => {
                    const fromPaintingInput = isPaintingInputJob(job.description);
                    const fromSeaValveInput = isSeaValveInputJob(job);
                    const scopePreview = formatJobScopePreview(job);
                    const scopeDefined = jobScopeIsDefined(job);
                    const yardProgress = displayYardProgress(
                      job.progressPct,
                      job.status,
                      scopeDefined,
                    );
                    return (
                    <TableRow key={job.id}>
                      <TableCell className="whitespace-normal align-top">
                        <Link
                          href={`/superintendent/jobs/${job.id}/edit`}
                          className="font-medium text-primary hover:underline"
                        >
                          {job.title}
                        </Link>
                        {fromPaintingInput ? (
                          <p className="mt-0.5">
                            <Link
                              href={`/superintendent/projects/${id}/inputs/vessel/condition`}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                            >
                              From Painting &amp; coating
                            </Link>
                          </p>
                        ) : fromSeaValveInput ? (
                          <p className="mt-0.5">
                            <Link
                              href={`/superintendent/projects/${id}/inputs/vessel/condition`}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                            >
                              From Sea valves
                            </Link>
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">{job.category}</TableCell>
                      <TableCell className="whitespace-normal align-top text-muted-foreground">
                        {job.workshop?.trim() ||
                          (job.description?.startsWith("Workshop:")
                            ? job.description.replace(/^Workshop:\s*/, "")
                            : "—")}
                      </TableCell>
                      <TableCell
                        className="whitespace-normal align-top text-xs text-muted-foreground"
                        title={scopePreview || undefined}
                      >
                        <p className="line-clamp-2 break-words">{scopePreview || "—"}</p>
                      </TableCell>
                      <TableCell className="align-top capitalize">{job.priority}</TableCell>
                      <TableCell className="whitespace-normal align-top capitalize">
                        {job.status.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="align-top" title={yardProgress.hint}>
                        <span
                          className={
                            yardProgress.label === "Scope set"
                              ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                              : "tabular-nums text-sm"
                          }
                        >
                          {yardProgress.label}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">{fmtMoney(job.budgetAmount)}</TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
