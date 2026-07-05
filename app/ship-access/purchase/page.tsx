"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
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

function useCrewRole() {
  const [canMasterApprove, setCanMasterApprove] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { roleCode?: string | null; assignedPageKeys?: string[] }
          | undefined;
        const keys = new Set(user?.assignedPageKeys ?? []);
        setCanMasterApprove(user?.roleCode === "MASTER" || keys.has("ship.purchase.masterApprove"));
      });
  }, []);

  return { canMasterApprove };
}

export default function ShipAccessPurchasePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading requisitions…</p>}>
      <ShipAccessPurchaseContent />
    </Suspense>
  );
}

function ShipAccessPurchaseContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const crew = useCrewRole();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [requisitions, setRequisitions] = useState<VesselRequisitionDto[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!ctx.vesselId) {
      setRequisitions([]);
      setEligibleCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", vesselId: ctx.vesselId });
      if (status !== "all") params.set("status", status);
      const [listRes, eligibleRes] = await Promise.all([
        fetch(`/api/ship-access/requisitions?${params}`),
        fetch(
          `/api/ship-access/requisitions?vesselId=${encodeURIComponent(ctx.vesselId)}&eligibleDefects=true`,
        ),
      ]);
      const listData = (await listRes.json()) as {
        requisitions?: VesselRequisitionDto[];
        error?: string;
      };
      const eligibleData = (await eligibleRes.json()) as { defects?: unknown[] };
      if (!listRes.ok) {
        setError(listData.error ?? "Failed to load requisitions");
        setRequisitions([]);
        return;
      }
      setRequisitions(listData.requisitions ?? []);
      setEligibleCount(eligibleData.defects?.length ?? 0);
    } finally {
      setLoading(false);
    }
  }, [ctx.vesselId, status]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  async function runAction(requisitionId: string, fn: () => Promise<Response>) {
    setBusyId(requisitionId);
    setActionError(null);
    try {
      const res = await fn();
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Action failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Purchase & requisitions"
        description="Prepare spares requisitions from Master-approved defects for office procurement."
        actions={
          <Button
            render={<Link href="/ship-access/purchase/new" />}
            nativeButton={false}
            disabled={!ctx.vesselId || eligibleCount === 0}
          >
            New requisition
          </Button>
        }
      />

      {eligibleCount > 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {eligibleCount} Master-approved defect{eligibleCount === 1 ? "" : "s"} ready for requisition.
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          No approved defects without requisitions. Report and approve defects first in{" "}
          <Link href="/ship-access/defects" className="text-primary hover:underline">
            Defects
          </Link>
          .
        </p>
      )}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[220px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All" }, ...VESSEL_REQUISITION_STATUS_ITEMS]}
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
      {actionError ? <p className="mb-3 text-sm text-destructive">{actionError}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading requisitions…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Req. no.</TableHead>
                  <TableHead>Heading / defect</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No requisitions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((req) => (
                    <TableRow key={req.id}>
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
                      <TableCell className="text-right">
                        <RequisitionRowActions
                          requisition={req}
                          busy={busyId === req.id}
                          canMasterApprove={crew.canMasterApprove}
                          onCancel={() =>
                            runAction(req.id, () =>
                              fetch(`/api/ship-access/requisitions/${req.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cancel: true }),
                              }),
                            )
                          }
                          onDelete={() =>
                            runAction(req.id, () =>
                              fetch(`/api/ship-access/requisitions/${req.id}`, {
                                method: "DELETE",
                              }),
                            )
                          }
                          onApprove={() =>
                            runAction(req.id, () =>
                              fetch(`/api/ship-access/requisitions/${req.id}/master-review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "approve" }),
                              }),
                            )
                          }
                          onReject={(reason) =>
                            runAction(req.id, () =>
                              fetch(`/api/ship-access/requisitions/${req.id}/master-review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "reject", rejectionReason: reason }),
                              }),
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function RequisitionRowActions({
  requisition,
  busy,
  canMasterApprove,
  onCancel,
  onDelete,
  onApprove,
  onReject,
}: {
  requisition: VesselRequisitionDto;
  busy: boolean;
  canMasterApprove: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (requisition.status === "master_approved" || requisition.status === "converted") {
    return (
      <span className="text-xs text-muted-foreground">
        {requisition.status === "converted" ? "Sent to office" : "Awaiting office"}
      </span>
    );
  }

  if (requisition.status === "cancelled") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {(requisition.status === "draft" || requisition.status === "rejected") && (
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/ship-access/purchase/${requisition.id}/edit`} />}
          nativeButton={false}
        >
          Edit
        </Button>
      )}
      {requisition.status === "draft" && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete()}>
          Delete
        </Button>
      )}
      {(requisition.status === "draft" || requisition.status === "submitted") && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel()}>
          Cancel
        </Button>
      )}
      {requisition.status === "submitted" && canMasterApprove && (
        <>
          <Button size="sm" disabled={busy} onClick={() => onApprove()}>
            Approve
          </Button>
          {!showReject ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setShowReject(true)}>
              Reject
            </Button>
          ) : (
            <div className="flex max-w-[200px] flex-col gap-1">
              <input
                className="rounded border px-2 py-1 text-xs"
                placeholder="Rejection reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || !rejectReason.trim()}
                onClick={() => {
                  onReject(rejectReason.trim());
                  setShowReject(false);
                  setRejectReason("");
                }}
              >
                Confirm reject
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
