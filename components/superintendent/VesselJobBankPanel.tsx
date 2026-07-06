"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  dryDockProjectId: string;
  onIntegrated?: () => void;
};

export function VesselJobBankPanel({ dryDockProjectId, onIntegrated }: Props) {
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [integrating, setIntegrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dryDockProjectId,
        limit: "50",
      });
      const res = await fetch(`/api/superintendent/vessel-jobs?${params}`);
      const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[] };
      setJobs(data.vesselJobs ?? []);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [dryDockProjectId]);

  useEffect(() => {
    if (expanded) void load();
  }, [expanded, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  }

  async function integrate() {
    if (selected.size === 0) return;
    setIntegrating(true);
    setError(null);
    try {
      const res = await fetch("/api/superintendent/vessel-jobs/integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselJobIds: Array.from(selected),
          dryDockProjectId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Integration failed");
        return;
      }
      await load();
      onIntegrated?.();
    } catch {
      setError("Network error");
    } finally {
      setIntegrating(false);
    }
  }

  async function action(id: string, path: "approve" | "reject" | "carry-forward") {
    setError(null);
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

  if (!expanded) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium">Vessel job bank</p>
            <p className="text-sm text-muted-foreground">
              Review ship-proposed jobs and integrate selected items into this project scope.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            Add from job bank
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Add from vessel job bank</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          Collapse
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <ActiniumLoadingState label="Loading job bank…" size="md" minHeight={100} />
        ) : jobs.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No eligible vessel jobs for this project. Ship staff can propose jobs from the vessel portal.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === jobs.length && jobs.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(job.id)}
                        onCheckedChange={() => toggle(job.id)}
                        aria-label={`Select ${job.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{job.category}</TableCell>
                    <TableCell className="capitalize">{job.source.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
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
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center gap-2 px-4">
              <Button size="sm" disabled={integrating || selected.size === 0} onClick={() => void integrate()}>
                {integrating ? "Integrating…" : `Integrate selected (${selected.size})`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
