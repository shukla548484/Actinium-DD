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
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { useClientTable } from "@/hooks/useClientTable";
import {
  DD_SIMPLE_JOB_STATUS_ITEMS,
  DD_SIMPLE_JOB_STATUS_LABELS,
  DD_SIMPLE_PAINT_JOB_TYPES,
  paintJobTypeLabel,
} from "@/lib/dryDockJobs/catalog";
import type { DdSimpleJobDto } from "@/lib/dryDockJobs/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { notify } from "@/lib/notify";

function useCrewRole() {
  const [canMasterApprove, setCanMasterApprove] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { roleCode?: string | null; assignedPageKeys?: string[] }
          | undefined;
        const keys = new Set(user?.assignedPageKeys ?? []);
        setCanMasterApprove(
          user?.roleCode === "MASTER" ||
            keys.has("ship.job.masterApprove") ||
            keys.has("page.shipAccess.simpleJobs.masterReview"),
        );
      });
  }, []);

  return { canMasterApprove };
}

export default function SimpleJobsPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState label="Loading jobs…" size="md" minHeight={140} />}>
      <SimpleJobsContent />
    </Suspense>
  );
}

function SimpleJobsContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const crew = useCrewRole();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [jobType, setJobType] = useState("all");
  const [jobs, setJobs] = useState<DdSimpleJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!ctx.vesselId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", vesselId: ctx.vesselId });
      if (status !== "all") params.set("status", status);
      if (jobType !== "all") params.set("jobType", jobType);
      const res = await fetch(`/api/ship-access/simple-jobs?${params}`);
      const data = (await res.json()) as { jobs?: DdSimpleJobDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load jobs");
        setJobs([]);
        return;
      }
      setJobs(data.jobs ?? []);
    } finally {
      setLoading(false);
    }
  }, [ctx.vesselId, status, jobType]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  async function review(jobId: string, action: "approve" | "reject") {
    let rejectionReason: string | null = null;
    if (action === "reject") {
      rejectionReason = window.prompt("Rejection reason")?.trim() || null;
      if (!rejectionReason) return;
    }
    setBusyId(jobId);
    try {
      const res = await fetch(`/api/ship-access/simple-jobs/${jobId}/master-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify.error(data.error ?? "Review failed");
        return;
      }
      notify.success(action === "approve" ? "Job approved" : "Job rejected");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const jobTypeItems = [
    { value: "all", label: "All paint jobs" },
    ...DD_SIMPLE_PAINT_JOB_TYPES.map((t) => ({ value: t.code, label: t.label })),
  ];

  const table = useClientTable({
    items: jobs,
    resetKey: `${status}|${jobType}`,
  });

  return (
    <PageShell size="wide">
      <PageHeader
        title="Jobs"
        description="Simple dry-dock Jobs template — Paint Jobs with prep by area × Sa grade × m²."
        actions={
          <Button
            render={<Link href="/ship-access/dry-dock/simple-jobs/new" />}
            nativeButton={false}
          >
            New job
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="w-full min-w-[14rem] sm:w-56">
            <LabeledSelect
              items={DD_SIMPLE_JOB_STATUS_ITEMS}
              value={status}
              onValueChange={setStatus}
              className="w-full"
            />
          </div>
          <div className="w-full min-w-[16rem] sm:w-72">
            <LabeledSelect
              items={jobTypeItems}
              value={jobType}
              onValueChange={setJobType}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <ActiniumLoadingState label="Loading jobs…" size="md" minHeight={120} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !ctx.vesselId ? (
        <p className="text-sm text-muted-foreground">Select a vessel to view Jobs.</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Jobs yet. Create a Paint Job to start.</p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Prep m²</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.pageItems.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{paintJobTypeLabel(job.jobType)}</TableCell>
                    <TableCell className="tabular-nums">{job.totalPrepSqm.toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.prepLines.length} prep · {job.coatLines.length} coat
                    </TableCell>
                    <TableCell>{DD_SIMPLE_JOB_STATUS_LABELS[job.status]}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/ship-access/dry-dock/simple-jobs/${job.id}`} />}
                        nativeButton={false}
                      >
                        Open
                      </Button>
                      {(job.status === "draft" || job.status === "rejected") && (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link href={`/ship-access/dry-dock/simple-jobs/${job.id}/edit`} />
                          }
                          nativeButton={false}
                        >
                          Edit
                        </Button>
                      )}
                      {crew.canMasterApprove && job.status === "submitted" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={busyId === job.id}
                            onClick={() => void review(job.id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === job.id}
                            onClick={() => void review(job.id, "reject")}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && !error && ctx.vesselId && jobs.length > 0 ? (
        <PaginationBar
          page={table.page}
          totalPages={table.totalPages}
          total={table.total}
          onPageChange={table.setPage}
        />
      ) : null}
    </PageShell>
  );
}
