"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import type { PmsItemStatus, PmsScheduleItemDto } from "@/lib/db/vesselPms";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type PmsResponse = {
  items?: PmsScheduleItemDto[];
  summary?: {
    overdue: number;
    dueSoon: number;
    ok: number;
    noSchedule: number;
    linkedJobs: number;
  };
};

const STATUS_LABEL: Record<PmsItemStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "On schedule",
  no_schedule: "No schedule",
};

function statusVariant(status: PmsItemStatus) {
  switch (status) {
    case "overdue":
      return "destructive" as const;
    case "due_soon":
      return "secondary" as const;
    case "ok":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export function PmsSchedulePanel({ apiPath = "/api/ship-access/pms" }: { apiPath?: string }) {
  const [data, setData] = useState<PmsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetch(apiPath)
      .then((r) => r.json())
      .then((d: PmsResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  async function proposeOverdue() {
    setProposing(true);
    setMessage(null);
    const res = await fetch("/api/ship-access/machinery/propose-overdue", { method: "POST" });
    setProposing(false);
    if (res.ok) {
      const body = (await res.json()) as { proposed?: number };
      setMessage(
        body.proposed
          ? `Created ${body.proposed} draft dry-dock job(s) from overdue PMS.`
          : "No new overdue items to propose.",
      );
      load();
    } else {
      setMessage("Could not propose jobs.");
    }
  }

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Overdue", value: summary.overdue },
            { label: "Due soon", value: summary.dueSoon },
            { label: "On schedule", value: summary.ok },
            { label: "No schedule", value: summary.noSchedule },
            { label: "Linked jobs", value: summary.linkedJobs },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {apiPath.includes("/superintendent/") ? null : (
          <Button type="button" size="sm" disabled={proposing} onClick={() => void proposeOverdue()}>
            {proposing ? "Proposing…" : "Propose overdue PMS jobs"}
          </Button>
        )}
        {apiPath.includes("/superintendent/") ? null : (
            <Button type="button" size="sm" variant="outline" render={<Link href="/ship-access/dry-dock/jobs" />} nativeButton={false}>
              View dry dock jobs
            </Button>
          )}
        </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <ActiniumLoadingState label="Loading PMS schedule…" size="sm" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Running hours</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Linked job</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No machinery assets registered for this vessel.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.assetId}>
                    <TableCell className="font-medium">{item.assetName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.department}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{item.currentRunningHours ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {item.nextDueDate
                        ? new Date(item.nextDueDate).toLocaleDateString()
                        : item.nextDueHours != null
                          ? `${item.nextDueHours} hrs`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.linkedJobId ? (
                        <Link href="/ship-access/dry-dock/jobs" className="text-primary hover:underline">
                          {item.linkedJobStatus ?? "draft"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
