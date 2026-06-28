import { Badge } from "@/components/ui/badge";
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

export function WorkshopJobBoard({
  jobs,
  showWorkshop = true,
}: {
  jobs: WorkshopJobRecord[];
  showWorkshop?: boolean;
}) {
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
            <TableRow key={job.id} className={cn(job.isCriticalPath && "bg-amber-50/50 dark:bg-amber-950/20")}>
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
                <Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status]}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{Math.round(job.progressPct)}%</TableCell>
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
