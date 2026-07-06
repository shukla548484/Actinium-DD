"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProjectInteractiveGantt } from "@/components/superintendent/ProjectInteractiveGantt";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

type TimelineData = Parameters<typeof ProjectInteractiveGantt>[0]["timeline"];

export default function ProjectTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void fetch(`/api/superintendent/projects/${id}/timeline`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.timeline ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Timeline"
        description="Interactive Gantt with baseline comparison and milestone dependencies."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/superintendent/planning/milestones?dryDockProjectId=${encodeURIComponent(id)}`}
              />
            }
            nativeButton={false}
          >
            Manage milestones
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ActiniumLoadingState label="Loading timeline…" size="sm" />
          ) : timeline ? (
            <ProjectInteractiveGantt projectId={id} timeline={timeline} onUpdated={load} />
          ) : (
            <p className="text-sm text-destructive">Timeline not available.</p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
