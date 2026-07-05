"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselSelect } from "@/components/superintendent/VesselSelect";
import { Button } from "@/components/ui/button";
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

export default function VesselRequisitionBankPage() {
  const [vesselId, setVesselId] = useState("");
  const [status, setStatus] = useState("all");
  const [requisitions, setRequisitions] = useState<VesselRequisitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", bankOnly: "true" });
      if (vesselId) params.set("vesselId", vesselId);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/superintendent/vessel-requisitions?${params}`);
      const data = (await res.json()) as {
        requisitions?: VesselRequisitionDto[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load requisition bank");
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

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel requisition bank"
        description="Master-approved spares requisitions from the vessel portal — convert into dry dock project spares from the project procurement page."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[200px] space-y-2">
            <p className="text-sm font-medium">Vessel</p>
            <VesselSelect value={vesselId} onChange={setVesselId} />
          </div>
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All open" }, ...VESSEL_REQUISITION_STATUS_ITEMS]}
              value={status}
              onValueChange={(v) => setStatus(v || "all")}
              className="w-full"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading requisition bank…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Req. no.</TableHead>
                  <TableHead>Heading / defect</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No requisitions in the bank.
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {req.vesselName}{" "}
                        <span className="text-muted-foreground">({req.vesselCode})</span>
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
                      <TableCell className="text-muted-foreground">
                        {req.submittedAt
                          ? new Date(req.submittedAt).toLocaleDateString()
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

      <p className="mt-4 text-sm text-muted-foreground">
        To convert requisitions into project spares, open a dry dock project →{" "}
        <Link href="/superintendent/projects" className="text-primary hover:underline">
          Procurement
        </Link>{" "}
        and use &quot;Add from requisition bank&quot;.
      </p>
    </PageShell>
  );
}
