"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtPct } from "@/lib/superintendent/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  progressPct: number | null;
  priority: string;
};

type WorkshopGroup = {
  name: string;
  jobs: JobRow[];
};

export default function ProjectWorkshopsPage() {
  const { id } = useParams<{ id: string }>();
  const [workshops, setWorkshops] = useState<WorkshopGroup[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}/workshops`)
      .then((r) => r.json())
      .then((d: { workshops?: WorkshopGroup[]; totalJobs?: number }) => {
        setWorkshops(d.workshops ?? []);
        setTotalJobs(d.totalJobs ?? 0);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PageShell>
      <PageHeader
        title="Workshops"
        description={`${totalJobs} jobs allocated across ${workshops.length} workshops.`}
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading workshops…</p>
      ) : workshops.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workshop allocation yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workshops.map((ws) => (
            <Card key={ws.name}>
              <CardHeader>
                <CardTitle className="text-base">{ws.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ws.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <Link
                        href={`/superintendent/jobs/${job.id}/edit`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{job.category}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className="capitalize">
                        {job.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmtPct(job.progressPct)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
