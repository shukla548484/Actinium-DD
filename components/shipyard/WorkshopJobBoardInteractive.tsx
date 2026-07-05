"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JOB_PRIORITY_LABELS, JOB_STATUS_LABELS } from "@/lib/shipyard/types";
import type { WorkshopJobRecord } from "@/lib/shipyard/types";
import { cn } from "@/lib/utils";

function statusVariant(status: WorkshopJobRecord["status"]) {
  switch (status) {
    case "completed":
      return "default" as const;
    case "in_progress":
      return "secondary" as const;
    case "blocked":
    case "awaiting_material":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

const STATUS_OPTIONS = Object.keys(JOB_STATUS_LABELS) as WorkshopJobRecord["status"][];

export function WorkshopJobBoardInteractive({
  jobs: initialJobs,
  showWorkshop = true,
  editable = true,
}: {
  jobs: WorkshopJobRecord[];
  showWorkshop?: boolean;
  editable?: boolean;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateJob(jobId: string, patch: { status?: string; progressPct?: number }) {
    setBusyId(jobId);
    const res = await fetch(`/api/shipyard/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusyId(null);
    if (!res.ok) return;
    const data = (await res.json()) as { job?: WorkshopJobRecord };
    if (data.job) {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...data.job! } : j)));
    }
  }

  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No workshop jobs yet. Open a project and initialize jobs from the owner scope.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Job</TableHead>
            {showWorkshop ? <TableHead>Workshop</TableHead> : null}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Progress</TableHead>
            <TableHead>Dependencies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className={cn(job.isCriticalPath && "bg-amber-50/50 dark:bg-amber-950/20")}
            >
              <TableCell className="font-mono text-xs">{job.jobCode ?? "—"}</TableCell>
              <TableCell>
                <div className="font-medium">{job.jobTitle}</div>
                {job.delayReason ? (
                  <div className="text-xs text-destructive">Delay: {job.delayReason}</div>
                ) : null}
              </TableCell>
              {showWorkshop ? (
                <TableCell className="text-sm text-muted-foreground">{job.workshopName}</TableCell>
              ) : null}
              <TableCell>
                <Badge variant="outline">{JOB_PRIORITY_LABELS[job.priority]}</Badge>
              </TableCell>
              <TableCell>
                {editable ? (
                  <Select
                    value={job.status}
                    disabled={busyId === job.id}
                    onValueChange={(v) => v && void updateJob(job.id, { status: v })}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {JOB_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status]}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={busyId === job.id || job.progressPct <= 0}
                      onClick={() => void updateJob(job.id, { progressPct: Math.max(0, job.progressPct - 10) })}
                    >
                      −
                    </Button>
                    <span className="w-10 tabular-nums text-sm">{Math.round(job.progressPct)}%</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={busyId === job.id || job.progressPct >= 100}
                      onClick={() => void updateJob(job.id, { progressPct: Math.min(100, job.progressPct + 10) })}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <span className="tabular-nums">{Math.round(job.progressPct)}%</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {job.predecessorIds.length > 0
                  ? `${job.predecessorIds.length} predecessor(s)`
                  : "—"}
                {job.isCriticalPath ? " · critical path" : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
