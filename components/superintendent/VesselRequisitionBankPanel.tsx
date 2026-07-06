"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { equipmentSystemLabel } from "@/lib/shipAccess/crewDefectSystems";
import type { VesselRequisitionDto } from "@/lib/shipAccess/requisitionDto";
import { requisitionStatusLabel } from "@/lib/shipAccess/requisitionTypes";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  dryDockProjectId: string;
  onIntegrated?: () => void;
};

export function VesselRequisitionBankPanel({ dryDockProjectId, onIntegrated }: Props) {
  const [requisitions, setRequisitions] = useState<VesselRequisitionDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [integrating, setIntegrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dryDockProjectId,
        limit: "50",
      });
      const res = await fetch(`/api/superintendent/vessel-requisitions?${params}`);
      const data = (await res.json()) as { requisitions?: VesselRequisitionDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load requisitions");
        setRequisitions([]);
        return;
      }
      setRequisitions(data.requisitions ?? []);
      setSelected(new Set());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [dryDockProjectId]);

  useEffect(() => {
    if (expanded) void load();
  }, [expanded, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === requisitions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requisitions.map((r) => r.id)));
    }
  }

  async function integrate() {
    if (selected.size === 0) return;
    setIntegrating(true);
    setError(null);
    try {
      const res = await fetch("/api/superintendent/vessel-requisitions/integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionIds: Array.from(selected),
          dryDockProjectId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Integration failed");
        return;
      }
      await load();
      onIntegrated?.();
    } catch {
      setError("Network error");
    } finally {
      setIntegrating(false);
    }
  }

  if (!expanded) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium">Vessel requisition bank</p>
            <p className="text-sm text-muted-foreground">
              Import Master-approved spares requisitions from the vessel portal into project spares.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            Add from requisition bank
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Add from vessel requisition bank</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          Collapse
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <ActiniumLoadingState label="Loading requisitions…" size="md" minHeight={100} />
        ) : requisitions.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No Master-approved requisitions for this vessel. Crew raise requisitions from approved
            defects in Ship Access → Purchase.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === requisitions.length && requisitions.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Req. no.</TableHead>
                  <TableHead>Heading / defect</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(req.id)}
                        onCheckedChange={() => toggle(req.id)}
                        aria-label={`Select ${req.requisitionNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{req.requisitionNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{req.heading}</div>
                      {req.defect ? (
                        <div className="text-xs text-muted-foreground">
                          {req.defect.title} ·{" "}
                          {equipmentSystemLabel(req.defect.equipmentSystem as never)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{req.lines.length}</TableCell>
                    <TableCell>{requisitionStatusLabel(req.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center gap-2 px-4">
              <Button
                size="sm"
                disabled={integrating || selected.size === 0}
                onClick={() => void integrate()}
              >
                {integrating
                  ? "Converting…"
                  : `Convert to spares (${selected.size} selected)`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
