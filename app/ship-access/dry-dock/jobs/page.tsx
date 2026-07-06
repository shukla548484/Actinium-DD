"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VESSEL_JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function DryDockJobsPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState label="Loading jobs…" size="md" minHeight={140} />}>
      <DryDockJobsContent />
    </Suspense>
  );
}

function DryDockJobsContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ctx.vesselId) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", vesselId: ctx.vesselId });
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/ship-access/jobs?${params}`);
    const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[] };
    setJobs(data.vesselJobs ?? []);
    setLoading(false);
  }, [ctx.vesselId, status]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Dry dock scope jobs"
        description="Proposed jobs from the master library awaiting Chief Engineer and superintendent review."
        actions={
          <Button render={<Link href="/ship-access/dry-dock/jobs/new" />} nativeButton={false}>
            Add job
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All" }, ...VESSEL_JOB_STATUS_ITEMS]}
              value={status}
              onValueChange={(v) => setStatus(v || "all")}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <ActiniumLoadingState label="Loading jobs…" size="md" minHeight={100} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Est. cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No jobs yet.{" "}
                      <Link href="/ship-access/dry-dock/jobs/new" className="text-primary hover:underline">
                        Add from master library
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.department ?? job.category}</TableCell>
                      <TableCell>
                        {job.conditionRating ? conditionRatingLabel(job.conditionRating) : "—"}
                      </TableCell>
                      <TableCell className="capitalize">{job.priority}</TableCell>
                      <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                      <TableCell>{job.estimatedCost != null ? `$${job.estimatedCost.toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/ship-access/dry-dock/jobs/${job.id}`} />}
                          nativeButton={false}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
