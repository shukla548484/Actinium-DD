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
import {
  defectStatusLabel,
  equipmentSystemLabel,
  VESSEL_DEFECT_STATUS_ITEMS,
} from "@/lib/shipAccess/crewDefectSystems";
import type { VesselDefectDto } from "@/lib/shipAccess/defectTypes";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function useCrewRole() {
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [canMasterApprove, setCanMasterApprove] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { roleCode?: string | null; assignedPageKeys?: string[] }
          | undefined;
        setRoleCode(user?.roleCode ?? null);
        const keys = new Set(user?.assignedPageKeys ?? []);
        setCanMasterApprove(user?.roleCode === "MASTER" || keys.has("ship.defect.masterApprove"));
      });
  }, []);

  return { roleCode, canMasterApprove };
}

export default function ShipAccessDefectsPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState label="Loading defects…" size="md" minHeight={140} />}>
      <ShipAccessDefectsContent />
    </Suspense>
  );
}

function ShipAccessDefectsContent() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const crew = useCrewRole();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [defects, setDefects] = useState<VesselDefectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!ctx.vesselId) {
      setDefects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", vesselId: ctx.vesselId });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/ship-access/defects?${params}`);
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
  }, [ctx.vesselId, status]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  async function runAction(
    defectId: string,
    fn: () => Promise<Response>,
  ) {
    setBusyId(defectId);
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
        title="Machinery defects"
        description="Report equipment defects, track Master approval, and prepare for office requisitions."
        actions={
          <Button
            render={<Link href="/ship-access/defects/new" />}
            nativeButton={false}
            disabled={!ctx.vesselId}
          >
            Report defect
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[220px] space-y-2">
            <p className="text-sm font-medium">Status</p>
            <LabeledSelect
              items={[{ value: "all", label: "All" }, ...VESSEL_DEFECT_STATUS_ITEMS]}
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
            <ActiniumLoadingState label="Loading defects…" size="md" minHeight={100} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment / system</TableHead>
                  <TableHead>Defect</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No defects yet.{" "}
                      <Link href="/ship-access/defects/new" className="text-primary hover:underline">
                        Report your first defect
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  defects.map((defect) => (
                    <TableRow key={defect.id}>
                      <TableCell>
                        <div className="font-medium">{equipmentSystemLabel(defect.equipmentSystem)}</div>
                        {defect.equipmentLabel ? (
                          <div className="text-xs text-muted-foreground">{defect.equipmentLabel}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{defect.title}</div>
                        {defect.location ? (
                          <div className="text-xs text-muted-foreground">{defect.location}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="capitalize">{defect.priority}</TableCell>
                      <TableCell>{defectStatusLabel(defect.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {defect.submittedAt
                          ? new Date(defect.submittedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DefectRowActions
                          defect={defect}
                          busy={busyId === defect.id}
                          canMasterApprove={crew.canMasterApprove}
                          onCancel={() =>
                            runAction(defect.id, () =>
                              fetch(`/api/ship-access/defects/${defect.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cancel: true }),
                              }),
                            )
                          }
                          onDelete={() =>
                            runAction(defect.id, () =>
                              fetch(`/api/ship-access/defects/${defect.id}`, { method: "DELETE" }),
                            )
                          }
                          onApprove={() =>
                            runAction(defect.id, () =>
                              fetch(`/api/ship-access/defects/${defect.id}/master-review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "approve" }),
                              }),
                            )
                          }
                          onReject={(reason) =>
                            runAction(defect.id, () =>
                              fetch(`/api/ship-access/defects/${defect.id}/master-review`, {
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

function DefectRowActions({
  defect,
  busy,
  canMasterApprove,
  onCancel,
  onDelete,
  onApprove,
  onReject,
}: {
  defect: VesselDefectDto;
  busy: boolean;
  canMasterApprove: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (defect.status === "master_approved") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">Locked</span>
        {defect.linkedVesselJobId ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/ship-access/dry-dock/jobs/${defect.linkedVesselJobId}`} />
            }
            nativeButton={false}
          >
            View scope job
          </Button>
        ) : (
          <Button
            size="sm"
            render={
              <Link
                href={`/ship-access/dry-dock/jobs/new?defectId=${encodeURIComponent(defect.id)}`}
              />
            }
            nativeButton={false}
          >
            Create scope job
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/ship-access/purchase/new?defectId=${encodeURIComponent(defect.id)}`} />}
          nativeButton={false}
        >
          Raise requisition
        </Button>
      </div>
    );
  }

  if (defect.status === "cancelled") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {(defect.status === "draft" || defect.status === "rejected") && (
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/ship-access/defects/${defect.id}/edit`} />}
          nativeButton={false}
        >
          Edit
        </Button>
      )}
      {defect.status === "draft" && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete()}>
          Delete
        </Button>
      )}
      {(defect.status === "draft" || defect.status === "submitted") && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel()}>
          Cancel
        </Button>
      )}
      {defect.status === "submitted" && canMasterApprove && (
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
