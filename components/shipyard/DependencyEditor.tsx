"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPENDENCY_CHAIN_TEMPLATE } from "@/lib/shipyard/workshops";
import type { WorkshopJobRecord } from "@/lib/shipyard/types";

function jobLabel(job: WorkshopJobRecord) {
  return job.jobTitle;
}

export function DependencyEditor({
  projectId,
  jobs: initialJobs,
}: {
  projectId: string;
  jobs: WorkshopJobRecord[];
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [predecessorId, setPredecessorId] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const [lagDays, setLagDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edges = useMemo(
    () =>
      jobs.flatMap((job) =>
        job.predecessorIds.map((predId) => {
          const pred = jobs.find((j) => j.id === predId);
          return pred ? { from: pred, to: job, key: `${predId}-${job.id}` } : null;
        }),
      ).filter(Boolean) as { from: WorkshopJobRecord; to: WorkshopJobRecord; key: string }[],
    [jobs],
  );

  const jobItems = useMemo(
    () => jobs.map((j) => ({ value: j.id, label: jobLabel(j) })),
    [jobs],
  );

  async function refreshJobs() {
    const res = await fetch(`/api/shipyard/projects/${projectId}/execution`);
    const data = (await res.json()) as { jobs?: WorkshopJobRecord[] };
    if (data.jobs) setJobs(data.jobs);
  }

  async function addLink() {
    if (!predecessorId || !successorId) {
      setError("Select both predecessor and successor jobs");
      return;
    }
    if (predecessorId === successorId) {
      setError("A job cannot depend on itself");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shipyard/jobs/${successorId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorJobId: predecessorId, lagDays }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not add dependency");
      return;
    }
    setPredecessorId("");
    setSuccessorId("");
    setLagDays(0);
    await refreshJobs();
    router.refresh();
  }

  async function removeLink(fromId: string, toId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shipyard/jobs/${toId}/dependencies`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorJobId: fromId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not remove dependency");
      return;
    }
    await refreshJobs();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add dependency</CardTitle>
          <CardDescription>
            Successor job cannot start until predecessor completes (optional lag in days).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Predecessor (must finish first)</Label>
              <Select
                items={jobItems}
                value={predecessorId || null}
                onValueChange={(v) => v && setPredecessorId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {jobLabel(j)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Successor (blocked until predecessor done)</Label>
              <Select
                items={jobItems}
                value={successorId || null}
                onValueChange={(v) => v && setSuccessorId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {jobLabel(j)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lag days</Label>
              <input
                type="number"
                min={0}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={lagDays}
                onChange={(e) => setLagDays(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={() => void addLink()} disabled={busy || jobs.length < 2}>
            Add link
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapped dependencies</CardTitle>
          <CardDescription>{edges.length} blocking link(s) on this project</CardDescription>
        </CardHeader>
        <CardContent>
          {edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No dependencies yet. Use the form above or initialize jobs from owner scope.
            </p>
          ) : (
            <ol className="space-y-2">
              {edges.map(({ from, to, key }) => (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{from.jobCode ?? from.id.slice(0, 6)}</span>
                    <span className="text-muted-foreground">{from.jobTitle}</span>
                    <span>→</span>
                    <span className="font-mono text-xs">{to.jobCode ?? to.id.slice(0, 6)}</span>
                    <span>{to.jobTitle}</span>
                    {to.isCriticalPath ? <Badge variant="outline">Critical path</Badge> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void removeLink(from.id, to.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference chain</CardTitle>
          <CardDescription>Typical dry-dock sequence for planning workshops</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 border-l-2 pl-4">
            {DEPENDENCY_CHAIN_TEMPLATE.map((step, i) => (
              <li key={step.jobTitle} className="relative pb-2 text-sm text-muted-foreground">
                <span className="absolute -left-[1.15rem] top-1 size-2 rounded-full bg-primary" />
                {i + 1}. {step.jobTitle} ({step.workshopSlug})
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
