"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { projectMonitoringHref } from "@/lib/superintendent/engine/workspaceLinks";
import { getStatusLabel } from "@/lib/superintendent/engine/statusWorkflow";
import type { DryDockProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ShipyardSummary = {
  selectedYard: string | null;
  shipyardCountry: string | null;
  status: string;
  lastShipyardSyncAt: string | null;
  tenderProject: { id: string; name: string } | null;
  counts: {
    totalJobs: number;
    inProgressJobs: number;
    delays: number;
    dailyReports: number;
  };
};

type SyncResult = {
  matched: number;
  pulled: number;
  pushed: number;
  syncedAt: string;
};

export default function ProjectShipyardPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<ShipyardSummary | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  function load() {
    void fetch(`/api/superintendent/projects/${id}/shipyard`)
      .then((r) => r.json())
      .then((d: { summary?: ShipyardSummary }) => setSummary(d.summary ?? null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function runSync(direction: "pull" | "push" | "both") {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch(`/api/superintendent/projects/${id}/shipyard/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setSyncing(false);
    if (res.ok) {
      const data = (await res.json()) as { result: SyncResult };
      setSyncResult(data.result);
      load();
    } else {
      const data = (await res.json()) as { error?: string };
      window.alert(data.error ?? "Sync failed");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Shipyard coordination"
        description="Yard execution sync, progress, and delay tracking for this project."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing || !summary?.tenderProject}
              onClick={() => void runSync("pull")}
            >
              Pull from yard
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing || !summary?.tenderProject}
              onClick={() => void runSync("push")}
            >
              Push to yard
            </Button>
            <Button
              size="sm"
              disabled={syncing || !summary?.tenderProject}
              onClick={() => void runSync("both")}
            >
              {syncing ? "Syncing…" : "Sync both ways"}
            </Button>
            {summary?.tenderProject ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/projects/${summary.tenderProject.id}`} />}
                nativeButton={false}
              >
                Tender project
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading shipyard summary…</p>
      ) : !summary ? (
        <p className="text-sm text-destructive">Shipyard data not available.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Selected yard", value: summary.selectedYard ?? "Not nominated" },
              { label: "Country", value: summary.shipyardCountry ?? "—" },
              {
                label: "Project status",
                value: getStatusLabel(summary.status as DryDockProjectStatus),
              },
              { label: "Jobs in progress", value: String(summary.counts.inProgressJobs) },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="font-semibold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bidirectional execution sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Matches superintendent jobs to shipyard workshop jobs by job code or title, then
                syncs progress and status.
              </p>
              {summary.lastShipyardSyncAt ? (
                <p>Last sync: {new Date(summary.lastShipyardSyncAt).toLocaleString()}</p>
              ) : (
                <p className="text-muted-foreground">Not synced yet.</p>
              )}
              {!summary.tenderProject ? (
                <p className="text-amber-600">Link a tender project on the edit page to enable sync.</p>
              ) : null}
              {syncResult ? (
                <p>
                  Matched {syncResult.matched} jobs — pulled {syncResult.pulled}, pushed{" "}
                  {syncResult.pushed}.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution registers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/superintendent/projects/${id}/scope`} />}
                nativeButton={false}
              >
                Jobs ({summary.counts.totalJobs})
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={projectMonitoringHref(id, "daily-reports")} />
                }
                nativeButton={false}
              >
                Daily reports ({summary.counts.dailyReports})
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={projectMonitoringHref(id, "delays")} />}
                nativeButton={false}
              >
                Delays ({summary.counts.delays})
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/superintendent/projects/${id}/workshops`} />}
                nativeButton={false}
              >
                Workshops
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/shipyard" />}
                nativeButton={false}
              >
                Shipyard portal
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
