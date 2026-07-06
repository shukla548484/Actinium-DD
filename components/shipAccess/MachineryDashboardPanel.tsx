"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPct } from "@/lib/superintendent/formatters";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import type { MachineryAssetDto } from "@/lib/db/vesselMachineryAssets";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type DashboardData = {
  machineryHealthScore: number | null;
  overdueJobs: number;
  runningHoursDue: number;
  criticalDeficiencies: number;
  monitorCount: number;
  assetCount: number;
  upcomingOverhauls: MachineryAssetDto[];
};

type Props = {
  vesselId: string | null;
  dryDockProjectId?: string | null;
};

export function MachineryDashboardPanel({ vesselId, dryDockProjectId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    if (!vesselId) return Promise.resolve();
    return fetch(`/api/ship-access/machinery/dashboard?vesselId=${vesselId}`)
      .then((r) => r.json())
      .then((d: { dashboard?: DashboardData }) => setData(d.dashboard ?? null));
  }, [vesselId]);

  useEffect(() => {
    if (!vesselId) {
      setLoading(false);
      return;
    }
    void loadDashboard().finally(() => setLoading(false));
  }, [vesselId, loadDashboard]);

  async function handleProposeOverdue() {
    if (!vesselId) return;
    setProposing(true);
    setProposeMsg(null);
    try {
      const res = await fetch("/api/ship-access/machinery/propose-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vesselId, dryDockProjectId }),
      });
      const body = (await res.json()) as { proposed?: number; error?: string };
      if (!res.ok) {
        setProposeMsg(body.error ?? "Could not propose overdue jobs.");
        return;
      }
      setProposeMsg(
        body.proposed
          ? `Created ${body.proposed} draft scope job${body.proposed === 1 ? "" : "s"}.`
          : "No new overdue maintenance jobs to propose.",
      );
      await loadDashboard();
    } finally {
      setProposing(false);
    }
  }

  if (!vesselId) {
    return <p className="text-sm text-muted-foreground">Select a vessel to view machinery status.</p>;
  }

  if (loading) return <ActiniumLoadingState label="Loading machinery dashboard…" size="sm" />;
  if (!data) return null;

  const overdueTotal = data.overdueJobs + data.runningHoursDue;

  const kpis = [
    {
      label: "Machinery health score",
      value: data.machineryHealthScore != null ? fmtPct(data.machineryHealthScore) : "—",
    },
    { label: "Overdue jobs", value: String(data.overdueJobs) },
    { label: "Running hours due", value: String(data.runningHoursDue) },
    { label: "Critical deficiencies", value: String(data.criticalDeficiencies) },
    { label: "Monitor status", value: String(data.monitorCount) },
    { label: "Registered assets", value: String(data.assetCount) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold tabular-nums">{kpi.value}</CardTitle>
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming overhauls</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcomingOverhauls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled overhauls recorded.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.upcomingOverhauls.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 py-2">
                  <span>
                    <span className="font-medium">{a.name}</span>
                    <span className="ml-2 text-muted-foreground">{a.department}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.nextDueDate
                      ? new Date(a.nextDueDate).toLocaleDateString()
                      : a.conditionRating
                        ? conditionRatingLabel(a.conditionRating)
                        : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {proposeMsg ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm">{proposeMsg}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/ship-access/machinery/running-hours" />} nativeButton={false}>
          Running hours
        </Button>
        <Button
          variant="outline"
          render={<Link href="/ship-access/machinery/parameters" />}
          nativeButton={false}
        >
          Parameters
        </Button>
        <Button
          variant="outline"
          render={<Link href="/ship-access/machinery/condition" />}
          nativeButton={false}
        >
          Condition reports
        </Button>
        {overdueTotal > 0 ? (
          <Button variant="secondary" disabled={proposing} onClick={() => void handleProposeOverdue()}>
            {proposing ? "Proposing…" : "Propose overdue PMS jobs"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
