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
import {
  defectStatusLabel,
  equipmentSystemLabel,
  VESSEL_DEFECT_STATUS_ITEMS,
} from "@/lib/shipAccess/crewDefectSystems";
import type { VesselDefectDto } from "@/lib/shipAccess/defectTypes";

type Props = {
  dryDockProjectId: string;
};

export function VesselDefectsPanel({ dryDockProjectId }: Props) {
  const [status, setStatus] = useState("all");
  const [defects, setDefects] = useState<VesselDefectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", dryDockProjectId });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/vessel-defects?${params}`);
      const data = (await res.json()) as { defects?: VesselDefectDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load defects");
        setDefects([]);
        return;
      }
      setDefects(data.defects ?? []);
    } finally {
      setLoading(false);
    }
  }, [dryDockProjectId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All" }, ...VESSEL_DEFECT_STATUS_ITEMS]}
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
            <p className="p-4 text-sm text-muted-foreground">Loading defects…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported by</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No defects reported for this vessel yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  defects.map((defect) => (
                    <TableRow key={defect.id}>
                      <TableCell className="font-medium">{defect.title}</TableCell>
                      <TableCell>{equipmentSystemLabel(defect.equipmentSystem)}</TableCell>
                      <TableCell className="capitalize">{defect.priority}</TableCell>
                      <TableCell>{defectStatusLabel(defect.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {defect.reportedByName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {defect.submittedAt
                          ? new Date(defect.submittedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
