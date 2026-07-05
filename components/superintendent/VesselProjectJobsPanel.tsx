"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

type Props = {
  dryDockProjectId: string;
  vesselId: string | null;
};

export function VesselProjectJobsPanel({ dryDockProjectId, vesselId }: Props) {
  const [status, setStatus] = useState("all");
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vesselId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", vesselId });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/vessel-jobs?${params}`);
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
  }, [vesselId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const integratedCount = jobs.filter((j) => j.status === "integrated").length;
  const pendingCount = jobs.filter((j) =>
    ["submitted", "approved", "carry_forward"].includes(j.status),
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{jobs.length}</p>
            <p className="text-sm text-muted-foreground">Total vessel jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{integratedCount}</p>
            <p className="text-sm text-muted-foreground">Integrated into scope</p>
          </CardContent>
        </Card>
      </div>

      <Card>
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
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/superintendent/projects/${dryDockProjectId}/scope`} />}
            nativeButton={false}
          >
            View project scope
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading vessel jobs…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No vessel jobs yet. Ship staff propose jobs from Ship Access or the vessel
                      portal.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.category}</TableCell>
                      <TableCell className="capitalize">{job.priority}</TableCell>
                      <TableCell className="capitalize">{job.source.replace(/_/g, " ")}</TableCell>
                      <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.integratedDryDockProjectId === dryDockProjectId
                          ? "Integrated here"
                          : job.targetDryDockProjectId === dryDockProjectId
                            ? "Targeted here"
                            : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
