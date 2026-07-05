"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
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
import {
  requisitionStatusLabel,
  VESSEL_REQUISITION_STATUS_ITEMS,
} from "@/lib/shipAccess/requisitionTypes";

type Props = {
  dryDockProjectId: string;
  vesselId: string | null;
};

export function VesselRequisitionsPanel({ dryDockProjectId, vesselId }: Props) {
  const [status, setStatus] = useState("all");
  const [requisitions, setRequisitions] = useState<VesselRequisitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vesselId) {
      setRequisitions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", vesselId });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/vessel-requisitions?${params}`);
      const data = (await res.json()) as { requisitions?: VesselRequisitionDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load requisitions");
        setRequisitions([]);
        return;
      }
      setRequisitions(data.requisitions ?? []);
    } finally {
      setLoading(false);
    }
  }, [vesselId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const approvedCount = requisitions.filter((r) => r.status === "master_approved").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{requisitions.length}</p>
            <p className="text-sm text-muted-foreground">Total requisitions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{approvedCount}</p>
            <p className="text-sm text-muted-foreground">Master-approved (ready for spares)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All" }, ...VESSEL_REQUISITION_STATUS_ITEMS]}
              value={status}
              onValueChange={(v) => setStatus(v || "all")}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading requisitions…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Req. no.</TableHead>
                  <TableHead>Heading</TableHead>
                  <TableHead>Defect</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No requisitions for this vessel yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{req.requisitionNumber}</TableCell>
                      <TableCell className="font-medium">{req.heading}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.defect ? (
                          <>
                            {req.defect.title} ·{" "}
                            {equipmentSystemLabel(req.defect.equipmentSystem as never)}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{req.lines.length}</TableCell>
                      <TableCell>{requisitionStatusLabel(req.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Use the integration panel below to convert Master-approved requisitions into project spares
        for {dryDockProjectId ? "this dry dock project" : "the project"}.
      </p>
    </div>
  );
}
