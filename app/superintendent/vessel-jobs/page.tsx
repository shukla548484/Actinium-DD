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
import { VESSEL_JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function VesselJobBankPage() {
  const [vesselId, setVesselId] = useState("");
  const [status, setStatus] = useState("all");
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", bankOnly: "true" });
      if (vesselId) params.set("vesselId", vesselId);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/vessel-jobs?${params}`);
      const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load job bank");
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

  async function action(id: string, path: "approve" | "reject" | "carry-forward") {
    const res = await fetch(`/api/superintendent/vessel-jobs/${id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Action failed");
      return;
    }
    await load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel job bank"
        description="Superintendent-curated inbox — ship-proposed jobs awaiting review and integration into dry dock scope."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[200px] space-y-2">
            <p className="text-sm font-medium">Vessel</p>
            <VesselSelect value={vesselId} onChange={setVesselId} />
          </div>
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All open" }, ...VESSEL_JOB_STATUS_ITEMS]}
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
            <ActiniumLoadingState label="Loading job bank…" size="md" minHeight={100} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No jobs in the bank.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        {job.vesselName}
                        <span className="ml-1 text-muted-foreground">({job.vesselCode})</span>
                      </TableCell>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.category}</TableCell>
                      <TableCell className="capitalize">{job.source.replace(/_/g, " ")}</TableCell>
                      <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.submittedAt ? new Date(job.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {job.targetDryDockProjectId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              render={
                                <Link
                                  href={`/superintendent/projects/${job.targetDryDockProjectId}/scope`}
                                />
                              }
                              nativeButton={false}
                            >
                              Scope
                            </Button>
                          ) : null}
                          {job.status === "submitted" ? (
                            <Button variant="ghost" size="sm" onClick={() => void action(job.id, "approve")}>
                              Approve
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => void action(job.id, "carry-forward")}>
                            Carry fwd
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void action(job.id, "reject")}>
                            Reject
                          </Button>
                        </div>
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
