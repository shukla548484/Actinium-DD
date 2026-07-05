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

export default function ShipAccessJobsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading jobs…</p>}>
      <ShipAccessJobsContent />
    </Suspense>
  );
}

function ShipAccessJobsContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const params = new URLSearchParams({ limit: "100", bankOnly: "true", vesselId: ctx.vesselId });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/ship-access/jobs?${params}`);
      const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load jobs");
        setJobs([]);
        return;
      }
      setJobs(data.vesselJobs ?? []);
    } finally {
      setLoading(false);
    }
  }, [ctx.vesselId, status]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="My job submissions"
        description="Track draft and submitted jobs awaiting superintendent review."
        actions={
          <Button render={<Link href="/ship-access/jobs/new" />} nativeButton={false} disabled={!ctx.vesselId}>
            Create job
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
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading jobs…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No jobs yet.{" "}
                      <Link href="/ship-access/jobs/new" className="text-primary hover:underline">
                        Create your first job
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.category}</TableCell>
                      <TableCell className="capitalize">{job.priority}</TableCell>
                      <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.submittedAt ? new Date(job.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.status === "draft" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/ship-access/jobs/${job.id}/edit`} />}
                            nativeButton={false}
                          >
                            Edit
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
