"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TableCard } from "@/components/layout/TableCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShipyardEstimatorOption, ShipyardRfqQueueRow } from "@/lib/db/shipyardRfq";
import {
  suggestedNextWorkflowStage,
  workflowActionLabel,
} from "@/lib/shipyard/rfqWorkflow";
import { YARD_RFQ_WORKFLOW_STAGES } from "@/lib/shipyard/workflow";
import { yardPortalUrl } from "@/lib/tender/format";

const STAGE_LABEL = Object.fromEntries(
  YARD_RFQ_WORKFLOW_STAGES.map((s) => [s.key, s.label]),
) as Record<string, string>;

const PRIORITY_VARIANT = {
  low: "outline",
  normal: "secondary",
  high: "default",
  urgent: "destructive",
} as const;

type RfqInboxPanelProps = {
  rows: ShipyardRfqQueueRow[];
  estimators: ShipyardEstimatorOption[];
};

export function RfqInboxPanel({ rows: initialRows, estimators }: RfqInboxPanelProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignRow, setAssignRow] = useState<ShipyardRfqQueueRow | null>(null);
  const [estimatorId, setEstimatorId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ShipyardRfqQueueRow["priority"]>("normal");
  const [error, setError] = useState<string | null>(null);

  const waiting = rows.filter((r) => r.workflowStage === "received" || r.workflowStage === "review").length;
  const inEstimate = rows.filter(
    (r) => r.workflowStage === "assign_estimator" || r.workflowStage === "cost_estimate",
  ).length;

  async function patchInvite(
    inviteId: string,
    body: Record<string, unknown>,
  ): Promise<ShipyardRfqQueueRow | null> {
    setBusyId(inviteId);
    setError(null);
    try {
      const res = await fetch(`/api/shipyard/rfq/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      return data.row as ShipyardRfqQueueRow;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function advanceStage(row: ShipyardRfqQueueRow) {
    const next = suggestedNextWorkflowStage(row.workflowStage);
    if (!next) return;
    const updated = await patchInvite(row.id, { workflowStage: next });
    if (updated) {
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
  }

  async function openAssignDialog(row: ShipyardRfqQueueRow) {
    setAssignRow(row);
    setEstimatorId(row.assignedEstimatorId ?? "");
    setDueDate(row.dueDate ? row.dueDate.slice(0, 10) : "");
    setPriority(row.priority);
    setError(null);
  }

  async function saveAssignment() {
    if (!assignRow) return;
    const updated = await patchInvite(assignRow.id, {
      workflowStage: estimatorId ? "cost_estimate" : "assign_estimator",
      assignedEstimatorId: estimatorId || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
    });
    if (updated) {
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setAssignRow(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">In queue</p>
          <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Waiting review</p>
          <p className="text-2xl font-semibold tabular-nums">{waiting}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">In estimation</p>
          <p className="text-2xl font-semibold tabular-nums">{inEstimate}</p>
        </div>
      </div>

      <TableCard
        title="RFQ queue"
        description="Review → assign estimator → cost estimate → internal approval → submit quotation."
      >
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No RFQs in queue. Office users create invites from{" "}
            <Link href="/projects" className="text-primary hover:underline">
              Projects → Yards
            </Link>
            .
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RFQ</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Docking</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Estimator</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="min-w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const next = suggestedNextWorkflowStage(row.workflowStage);
                const busy = busyId === row.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.rfqReference}</div>
                      <div className="text-xs text-muted-foreground">{row.projectName}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.receivedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.vesselName ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.dockingWindow ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STAGE_LABEL[row.workflowStage] ?? row.workflowStage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.assignedEstimatorName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[row.priority]}>{row.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {next && row.workflowStage !== "assign_estimator" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void advanceStage(row)}
                          >
                            {workflowActionLabel(next)}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => openAssignDialog(row)}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => router.push(`/shipyard/estimation?invite=${row.id}`)}
                        >
                          Estimate
                        </Button>
                        <Link
                          href={yardPortalUrl(row.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="self-center px-1 text-xs text-primary hover:underline"
                        >
                          Portal
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={Boolean(assignRow)} onOpenChange={(open) => !open && setAssignRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign estimator</DialogTitle>
            <DialogDescription>
              {assignRow?.rfqReference} — {assignRow?.projectName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Estimator</Label>
              <SearchableSelect
                items={[
                  { value: "", label: "Unassigned" },
                  ...estimators.map((e) => ({
                    value: e.id,
                    label: e.label,
                    searchText: `${e.label} ${e.designation ?? ""}`,
                  })),
                ]}
                value={estimatorId}
                onValueChange={setEstimatorId}
                placeholder="Select estimator…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rfq-due">Due date</Label>
              <Input
                id="rfq-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <SearchableSelect
                items={(["low", "normal", "high", "urgent"] as const).map((p) => ({
                  value: p,
                  label: p,
                }))}
                value={priority}
                onValueChange={(v) => setPriority(v as ShipyardRfqQueueRow["priority"])}
              />
            </div>
            <Button onClick={() => void saveAssignment()} disabled={busyId === assignRow?.id}>
              Save assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
