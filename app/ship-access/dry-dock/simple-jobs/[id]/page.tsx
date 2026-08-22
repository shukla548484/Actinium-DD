"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  DD_SIMPLE_JOB_STATUS_LABELS,
  paintJobTypeLabel,
} from "@/lib/dryDockJobs/catalog";
import type { DdSimpleJobDto } from "@/lib/dryDockJobs/types";

function SimpleJobDetailContent() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<DdSimpleJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ship-access/simple-jobs/${params.id}`);
        const data = (await res.json()) as { job?: DdSimpleJobDto; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load job");
          setJob(null);
          return;
        }
        setJob(data.job ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return <ActiniumLoadingState label="Loading job…" size="md" minHeight={140} />;
  }

  if (error || !job) {
    return (
      <PageShell>
        <PageHeader title="Job" />
        <p className="text-sm text-destructive">{error ?? "Job not found"}</p>
      </PageShell>
    );
  }

  const canEdit = job.status === "draft" || job.status === "rejected";

  return (
    <PageShell size="wide">
      <PageHeader
        title={job.title}
        description={`${paintJobTypeLabel(job.jobType)} · ${DD_SIMPLE_JOB_STATUS_LABELS[job.status]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button
                render={<Link href={`/ship-access/dry-dock/simple-jobs/${job.id}/edit`} />}
                nativeButton={false}
              >
                Edit
              </Button>
            ) : null}
            <Button
              variant="outline"
              render={<Link href="/ship-access/dry-dock/simple-jobs" />}
              nativeButton={false}
            >
              Back to Jobs
            </Button>
          </div>
        }
      />

      {job.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preparation lines</CardTitle>
          <CardDescription>
            Total {job.totalPrepSqm.toFixed(1)} m² — cost driver is area × Sa/prep grade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {job.prepLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prep lines.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Prep / Sa</TableHead>
                  <TableHead>m²</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.prepLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.areaLabel ?? line.areaCode}</TableCell>
                    <TableCell>{line.prepMethodLabel ?? line.prepMethodCode}</TableCell>
                    <TableCell className="tabular-nums">{line.areaSqm}</TableCell>
                    <TableCell className="text-muted-foreground">{line.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coating lines</CardTitle>
        </CardHeader>
        <CardContent>
          {job.coatLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coating lines.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Primer</TableHead>
                  <TableHead>Binder</TableHead>
                  <TableHead>Finish</TableHead>
                  <TableHead>DFT</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.coatLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.areaLabel ?? line.areaCode}</TableCell>
                    <TableCell className="tabular-nums">{line.primerCoats}</TableCell>
                    <TableCell className="tabular-nums">{line.binderCoats}</TableCell>
                    <TableCell className="tabular-nums">{line.finishCoats}</TableCell>
                    <TableCell>
                      {line.dftRequired
                        ? `${line.dftUm ?? "—"} µm`
                        : "Not required"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function SimpleJobDetailPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <SimpleJobDetailContent />
    </Suspense>
  );
}
