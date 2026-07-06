"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselJobAttachmentsPanel } from "@/components/shipAccess/VesselJobAttachmentsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function DryDockJobReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<DdVesselJobDto | null>(null);
  const [notes, setNotes] = useState("");
  const [carryForward, setCarryForward] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [canMasterApprove, setCanMasterApprove] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ship-access/jobs/${id}`);
    const data = (await res.json()) as { vesselJob?: DdVesselJobDto };
    setJob(data.vesselJob ?? null);
  }, [id]);

  useEffect(() => {
    void load();
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { roleCode?: string | null; assignedPageKeys?: string[] }
          | undefined;
        setRoleCode(user?.roleCode ?? null);
        const keys = new Set(user?.assignedPageKeys ?? []);
        setCanMasterApprove(user?.roleCode === "MASTER" || keys.has("ship.job.masterApprove"));
      });
  }, [load]);

  const canCeReview = roleCode === "CENG" || roleCode === "2ENG";

  async function ceReview(action: "approved" | "rejected" | "returned") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ship-access/vessel-jobs/${id}/ce-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewedBy: roleCode ?? "Chief Engineer", notes }),
    });
    setBusy(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Review failed");
      return;
    }
    void load();
  }

  async function masterReview(action: "approved" | "rejected" | "returned") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ship-access/vessel-jobs/${id}/master-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reviewedBy: roleCode ?? "Master",
        notes,
        carryForward: action === "approved" ? carryForward : false,
      }),
    });
    setBusy(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Review failed");
      return;
    }
    void load();
  }

  if (!job) {
    return (
      <PageShell>
        <ActiniumLoadingState label="Loading job…" size="sm" />
      </PageShell>
    );
  }

  const readOnlyAttachments = job.status === "integrated" || job.status === "rejected";

  return (
    <PageShell size="wide">
      <PageHeader
        title={job.title}
        description={`${job.department ?? job.category} · ${job.workshop ?? "—"} · ${job.status.replace(/_/g, " ")}`}
      />

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {job.linkedDefectId ? (
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm">
            Linked to Master-approved defect (ID: {job.linkedDefectId})
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Job information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Priority:</span> {job.priority}</p>
            <p><span className="text-muted-foreground">Condition:</span> {job.conditionRating ? conditionRatingLabel(job.conditionRating) : "—"}</p>
            <p><span className="text-muted-foreground">Est. manhours:</span> {job.estimatedManhours ?? "—"}</p>
            <p><span className="text-muted-foreground">Est. cost:</span> {job.estimatedCost != null ? `$${job.estimatedCost.toLocaleString()}` : "—"}</p>
            <p><span className="text-muted-foreground">Submitted by:</span> {job.createdByName ?? "—"}</p>
            <p><span className="text-muted-foreground">Photos:</span> {job.photoCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Current condition</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{job.conditionDescription ?? job.description ?? "—"}</p>
            {job.observedDefect ? (
              <p><span className="text-muted-foreground">Observed defect:</span> {job.observedDefect}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recommended repair</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{job.repairRecommendation ?? "—"}</p>
            {job.replacementParts ? (
              <p className="mt-2"><span className="text-muted-foreground">Parts:</span> {job.replacementParts}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Photos & attachments</CardTitle></CardHeader>
          <CardContent>
            <VesselJobAttachmentsPanel vesselJobId={job.id} readOnly={readOnlyAttachments} />
          </CardContent>
        </Card>
      </div>

      {canCeReview && job.status === "submitted" ? (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Chief Engineer review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Review notes (required for reject / return)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void ceReview("approved")}>Approve</Button>
              <Button variant="outline" disabled={busy} onClick={() => void ceReview("returned")}>
                Return to officer
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => void ceReview("rejected")}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canMasterApprove && job.status === "approved" && !job.masterReviewedAt ? (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Master review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Endorsement notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={carryForward}
                onChange={(e) => setCarryForward(e.target.checked)}
              />
              Mark as carry-forward for next dry dock
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void masterReview("approved")}>
                Endorse
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void masterReview("returned")}>
                Return to CE
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => void masterReview("rejected")}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {job.ceReviewedAt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          CE review: {job.ceReviewAction} by {job.ceReviewedBy} on{" "}
          {new Date(job.ceReviewedAt).toLocaleString()}
        </p>
      ) : null}

      {job.masterReviewedAt ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Master review: {job.masterReviewAction} by {job.masterReviewedBy} on{" "}
          {new Date(job.masterReviewedAt).toLocaleString()}
        </p>
      ) : null}
    </PageShell>
  );
}
