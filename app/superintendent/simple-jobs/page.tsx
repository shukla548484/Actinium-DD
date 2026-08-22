"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselSelect } from "@/components/superintendent/VesselSelect";
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
import {
  DD_SIMPLE_JOB_STATUS_ITEMS,
  DD_SIMPLE_JOB_STATUS_LABELS,
  paintJobTypeLabel,
} from "@/lib/dryDockJobs/catalog";
import type { DdSimpleJobDto } from "@/lib/dryDockJobs/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function SuperintendentSimpleJobsPage() {
  const [vesselId, setVesselId] = useState("");
  const [status, setStatus] = useState("all");
  const [jobs, setJobs] = useState<DdSimpleJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (vesselId) params.set("vesselId", vesselId);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/simple-jobs?${params}`);
      const data = (await res.json()) as { jobs?: DdSimpleJobDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load Jobs");
        setJobs([]);
        return;
      }
      setJobs(data.jobs ?? []);
    } finally {
      setLoading(false);
    }
  }, [vesselId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Jobs"
        description="Simple dry-dock Jobs from ship access (Paint Jobs template — separate from library job bank)."
      />

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="min-w-[14rem]">
            <VesselSelect value={vesselId} onChange={setVesselId} />
          </div>
          <div className="min-w-[10rem]">
            <LabeledSelect
              items={DD_SIMPLE_JOB_STATUS_ITEMS}
              value={status}
              onValueChange={setStatus}
            />
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <ActiniumLoadingState label="Loading Jobs…" size="md" minHeight={120} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Jobs found.</p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Prep m²</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      {job.vesselName} ({job.vesselCode})
                    </TableCell>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{paintJobTypeLabel(job.jobType)}</TableCell>
                    <TableCell className="tabular-nums">{job.totalPrepSqm.toFixed(1)}</TableCell>
                    <TableCell>{DD_SIMPLE_JOB_STATUS_LABELS[job.status]}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/ship-access/dry-dock/simple-jobs/${job.id}`} />}
                        nativeButton={false}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
