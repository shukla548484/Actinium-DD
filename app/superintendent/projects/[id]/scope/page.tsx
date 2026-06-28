"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselJobBankPanel } from "@/components/superintendent/VesselJobBankPanel";
import { fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  jobCode: string | null;
  title: string;
  category: string;
  description: string | null;
  workshop: string | null;
  status: string;
  priority: string;
  progressPct: number | null;
  budgetAmount: number | null;
};

export default function ProjectScopePage() {
  const { id } = useParams<{ id: string }>();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(() => {
    setLoading(true);
    void fetch(`/api/superintendent/jobs?dryDockProjectId=${encodeURIComponent(id)}&limit=100`)
      .then((r) => r.json())
      .then((d: { items?: JobRow[] }) => setJobs(d.items ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Scope of work"
        description="Job library for this dry dock project."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/superintendent/jobs/import?dryDockProjectId=${encodeURIComponent(id)}`}
                />
              }
              nativeButton={false}
            >
              Import Excel
            </Button>
            <Button
              size="sm"
              render={
                <Link href={`/superintendent/jobs/new?dryDockProjectId=${encodeURIComponent(id)}`} />
              }
              nativeButton={false}
            >
              Add job
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <VesselJobBankPanel dryDockProjectId={id} onIntegrated={loadJobs} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading scope…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No jobs in scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link
                          href={`/superintendent/jobs/${job.id}/edit`}
                          className="font-medium text-primary hover:underline"
                        >
                          {job.title}
                        </Link>
                      </TableCell>
                      <TableCell>{job.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.workshop?.trim() ||
                          (job.description?.startsWith("Workshop:")
                            ? job.description.replace(/^Workshop:\s*/, "")
                            : "—")}
                      </TableCell>
                      <TableCell className="capitalize">{job.priority}</TableCell>
                      <TableCell className="capitalize">{job.status.replace(/_/g, " ")}</TableCell>
                      <TableCell>{fmtPct(job.progressPct)}</TableCell>
                      <TableCell>{fmtMoney(job.budgetAmount)}</TableCell>
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
