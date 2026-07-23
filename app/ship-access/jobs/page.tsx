"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DdVesselJobAssignedParty } from "@prisma/client";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { ShipJobActionsMenu } from "@/components/shipAccess/ShipJobActionsMenu";
import { ShipJobScopeDialog } from "@/components/shipAccess/ShipJobScopeDialog";
import { ShareJobsToShipyardDialog } from "@/components/shipAccess/ShareJobsToShipyardDialog";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  VESSEL_JOB_ASSIGNED_PARTY_ITEMS,
  VESSEL_JOB_ASSIGNED_PARTY_LABELS,
  VESSEL_JOB_STATUS_ITEMS,
} from "@/lib/superintendent/constants";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { notify } from "@/lib/notify";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

const ASSIGN_FILTER_ITEMS = [
  { value: "all", label: "All parties" },
  { value: "unassigned", label: "Unassigned" },
  ...VESSEL_JOB_ASSIGNED_PARTY_ITEMS,
];

const ASSIGN_ROW_ITEMS = [
  { value: "unassigned", label: "Unassigned" },
  ...VESSEL_JOB_ASSIGNED_PARTY_ITEMS,
];

function canMoveJob(job: DdVesselJobDto): boolean {
  return (
    !job.archivedAt &&
    job.status !== "integrated" &&
    job.status !== "rejected" &&
    !job.integratedDryDockProjectId
  );
}

export default function ShipAccessJobsPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState label="Loading jobs…" size="md" minHeight={140} />}>
      <ShipAccessJobsIndex />
    </Suspense>
  );
}

/** Index of vessel-scoped job submissions for the selected ship only. */
function ShipAccessJobsIndex() {
  const ctx = useShipAccessContext();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [assignedPartyFilter, setAssignedPartyFilter] = useState(
    searchParams.get("assignedParty") ?? "all",
  );
  const [jobs, setJobs] = useState<DdVesselJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetVesselId, setTargetVesselId] = useState("");
  const [moving, setMoving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scopeJobId, setScopeJobId] = useState<string | null>(null);
  const [scopeJobTitle, setScopeJobTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
    setAssignedPartyFilter(searchParams.get("assignedParty") ?? "all");
  }, [searchParams]);

  const vesselId = ctx.vesselId ?? null;
  const vessels = ctx.vessels ?? [];
  const vesselLabel = ctx.vessel
    ? `${ctx.vessel.name} (${ctx.vessel.code})`
    : "No vessel selected";

  const otherVessels = useMemo(
    () => vessels.filter((v) => v.id !== vesselId),
    [vessels, vesselId],
  );

  const otherVesselItems = useMemo(
    () =>
      mapSelectItems(
        otherVessels,
        (v) => v.id,
        (v) => `${v.name} (${v.code})`,
      ),
    [otherVessels],
  );

  const load = useCallback(async () => {
    if (!vesselId) {
      setJobs([]);
      setSelectedIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "100",
        bankOnly: "true",
        vesselId,
      });
      if (status !== "all") params.set("status", status);
      if (
        assignedPartyFilter !== "all" &&
        assignedPartyFilter !== "unassigned" &&
        assignedPartyFilter in VESSEL_JOB_ASSIGNED_PARTY_LABELS
      ) {
        params.set("assignedParty", assignedPartyFilter);
      }
      const res = await fetch(`/api/ship-access/jobs?${params}`);
      const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load jobs");
        setJobs([]);
        setSelectedIds(new Set());
        return;
      }
      // Client-side vessel isolation + unassigned filter.
      let rows = (data.vesselJobs ?? []).filter((job) => job.vesselId === vesselId);
      if (assignedPartyFilter === "unassigned") {
        rows = rows.filter((job) => !job.assignedParty);
      }
      setJobs(rows);
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (rows.some((job) => job.id === id && canMoveJob(job))) next.add(id);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [assignedPartyFilter, status, vesselId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  useEffect(() => {
    setTargetVesselId("");
    setSelectedIds(new Set());
  }, [vesselId]);

  const movableJobs = useMemo(() => jobs.filter(canMoveJob), [jobs]);
  const allMovableSelected =
    movableJobs.length > 0 && movableJobs.every((job) => selectedIds.has(job.id));

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(movableJobs.map((job) => job.id)));
    },
    [movableJobs],
  );

  const toggleSelect = useCallback((jobId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }, []);

  const assignParty = useCallback(
    async (jobId: string, value: string) => {
      const job = jobs.find((row) => row.id === jobId);
      const assignedParty =
        value === "unassigned" || !value ? null : (value as DdVesselJobAssignedParty);
      const current = job?.assignedParty ?? null;
      if (current === assignedParty) return;

      setAssigningId(jobId);
      try {
        const res = await fetch(`/api/ship-access/jobs/${jobId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign_party", assignedParty }),
        });
        const raw = await res.text();
        let data: {
          error?: string;
          message?: string;
          vesselJob?: DdVesselJobDto;
        } = {};
        if (raw.trim()) {
          try {
            data = JSON.parse(raw) as typeof data;
          } catch {
            notify.error(
              res.ok
                ? "Invalid response from server"
                : `Assign failed (HTTP ${res.status})`,
            );
            return;
          }
        } else if (!res.ok) {
          notify.error(`Assign failed (HTTP ${res.status})`);
          return;
        }
        if (!res.ok) {
          notify.error(data.error ?? "Could not assign job");
          return;
        }
        notify.success(
          data.message ??
            (assignedParty
              ? `Assigned to ${VESSEL_JOB_ASSIGNED_PARTY_LABELS[assignedParty]}`
              : "Assignment cleared"),
        );
        if (data.vesselJob) {
          setJobs((prev) =>
            prev
              .map((row) => (row.id === jobId ? data.vesselJob! : row))
              .filter((row) => {
                if (assignedPartyFilter === "unassigned") return !row.assignedParty;
                if (
                  assignedPartyFilter !== "all" &&
                  assignedPartyFilter !== "unassigned"
                ) {
                  return row.assignedParty === assignedPartyFilter;
                }
                return true;
              }),
          );
        } else {
          await load();
        }
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Could not assign job");
      } finally {
        setAssigningId(null);
      }
    },
    [assignedPartyFilter, jobs, load],
  );

  const moveSelectedToVessel = useCallback(async () => {
    if (selectedIds.size === 0) {
      notify.warning("Select one or more jobs first");
      return;
    }
    if (!targetVesselId) {
      notify.warning("Choose a target vessel assigned to you");
      return;
    }
    if (targetVesselId === vesselId) {
      notify.warning("Jobs are already on this vessel");
      return;
    }

    const target = otherVessels.find((v) => v.id === targetVesselId);
    setMoving(true);
    try {
      const res = await fetch("/api/ship-access/jobs/reassign-vessel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobIds: [...selectedIds],
          targetVesselId,
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        message?: string;
        moved?: number;
        skipped?: { id: string; reason: string }[];
      } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          notify.error(
            res.ok
              ? "Invalid response from server"
              : `Could not move jobs (HTTP ${res.status})`,
          );
          return;
        }
      } else if (!res.ok) {
        notify.error(`Could not move jobs (HTTP ${res.status})`);
        return;
      }
      if (!res.ok) {
        notify.error(data.error ?? "Could not move jobs");
        return;
      }
      const skippedCount = data.skipped?.length ?? 0;
      notify.success(
        data.message ??
          `Moved ${data.moved ?? 0} job(s)${
            target ? ` to ${target.name} (${target.code})` : ""
          }`,
      );
      if (skippedCount > 0) {
        notify.warning(
          `${skippedCount} job(s) were skipped (integrated, rejected, or already there)`,
        );
      }
      setSelectedIds(new Set());
      setTargetVesselId("");
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not move jobs");
    } finally {
      setMoving(false);
    }
  }, [load, otherVessels, selectedIds, targetVesselId, vesselId]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Jobs"
        description={
          vesselId
            ? `Job index for ${vesselLabel}. Assign each job to a party, or move selected jobs to another vessel assigned to you.`
            : "Select a vessel in the ship access bar to view and assign jobs."
        }
        actions={
          <Button
            render={<Link href="/ship-access/jobs/new" />}
            nativeButton={false}
            disabled={!vesselId}
          >
            Create job
          </Button>
        }
      />

      {!vesselId && !ctx.loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No vessel selected. Choose a vessel above to list jobs for that vessel only.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-4 py-0">
            <CardContent className="px-4 py-2 md:px-6">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex min-w-[14rem] flex-[1.4] flex-col gap-1.5">
                  <p className="h-5 text-sm font-medium leading-5">Vessel</p>
                  <div className="box-border flex h-8 w-full items-center truncate rounded-lg border border-input bg-muted/40 px-2.5 text-sm font-medium">
                    {vesselLabel}
                  </div>
                </div>
                <div className="flex min-w-[11rem] flex-1 flex-col gap-1.5">
                  <p className="h-5 text-sm font-medium leading-5">Status</p>
                  <LabeledSelect
                    items={[{ value: "all", label: "All" }, ...VESSEL_JOB_STATUS_ITEMS]}
                    value={status}
                    onValueChange={(v) => setStatus(v || "all")}
                    className="h-8 w-full min-w-0 py-0"
                  />
                </div>
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
                  <p className="h-5 text-sm font-medium leading-5">Assigned to</p>
                  <LabeledSelect
                    items={ASSIGN_FILTER_ITEMS}
                    value={assignedPartyFilter}
                    onValueChange={(v) => setAssignedPartyFilter(v || "all")}
                    className="h-8 w-full min-w-0 py-0"
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <p className="h-5 text-sm font-medium leading-5 opacity-0" aria-hidden>
                    Refresh
                  </p>
                  <Button variant="outline" className="h-8" onClick={() => void load()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-end gap-4 py-4">
              <div className="min-w-[160px] space-y-1">
                <p className="text-sm font-medium">Selected jobs</p>
                <p className="text-xs text-muted-foreground">
                  {selectedIds.size === 0
                    ? "Select jobs in the list to move vessels or share for quotation."
                    : `${selectedIds.size} job${selectedIds.size === 1 ? "" : "s"} selected`}
                </p>
              </div>
              <Button
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShareOpen(true)}
              >
                Share to shipyard for quotation
              </Button>
              {otherVessels.length > 0 ? (
                <>
                  <div className="min-w-[240px] flex-1 space-y-2">
                    <p className="text-sm font-medium">Move to vessel</p>
                    <LabeledSelect
                      items={[
                        { value: "", label: "Select vessel…" },
                        ...otherVesselItems,
                      ]}
                      value={targetVesselId}
                      onValueChange={setTargetVesselId}
                      placeholder="Select vessel…"
                      className="w-full"
                      disabled={selectedIds.size === 0 || moving}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedIds.size === 0 || !targetVesselId || moving}
                    onClick={() => void moveSelectedToVessel()}
                  >
                    {moving ? "Moving…" : "Assign to vessel"}
                  </Button>
                </>
              ) : vessels.length <= 1 ? (
                <p className="text-xs text-muted-foreground">
                  Only one assigned vessel — jobs cannot be moved to another ship from here.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <ShareJobsToShipyardDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            jobIds={[...selectedIds]}
            vesselId={vesselId}
            onShared={() => {
              setSelectedIds(new Set());
              void load();
            }}
          />

          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <ActiniumLoadingState label="Loading jobs…" size="md" minHeight={100} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allMovableSelected}
                          disabled={movableJobs.length === 0}
                          onCheckedChange={(c) => toggleSelectAll(c === true)}
                          aria-label="Select all movable jobs"
                        />
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Assignment No.</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[220px]">Assign to</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No jobs for this vessel yet.{" "}
                          <Link
                            href="/ship-access/jobs/new"
                            className="text-primary hover:underline"
                          >
                            Create your first job
                          </Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((job) => {
                        const movable = canMoveJob(job);
                        return (
                          <TableRow key={job.id} data-selected={selectedIds.has(job.id) || undefined}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(job.id)}
                                disabled={!movable || moving}
                                onCheckedChange={(c) => toggleSelect(job.id, c === true)}
                                aria-label={`Select ${job.title}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="max-w-[28rem] text-left text-primary underline-offset-2 hover:underline"
                                onClick={() => {
                                  setScopeJobId(job.id);
                                  setScopeJobTitle(job.title);
                                }}
                              >
                                {job.title}
                              </button>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {job.jobCode ?? "—"}
                              {job.exportAssignedAt ? (
                                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-emerald-700">
                                  Export ready
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell>{job.category}</TableCell>
                            <TableCell className="capitalize">{job.priority}</TableCell>
                            <TableCell className="capitalize">
                              {job.status.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <LabeledSelect
                                items={ASSIGN_ROW_ITEMS}
                                value={job.assignedParty ?? "unassigned"}
                                onValueChange={(v) => void assignParty(job.id, v)}
                                className="w-full min-w-[200px]"
                                disabled={
                                  assigningId === job.id ||
                                  Boolean(job.archivedAt) ||
                                  job.status === "integrated" ||
                                  job.status === "rejected"
                                }
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {job.submittedAt
                                ? new Date(job.submittedAt).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <ShipJobActionsMenu job={job} onChanged={() => void load()} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ShipJobScopeDialog
        jobId={scopeJobId}
        previewTitle={scopeJobTitle}
        open={scopeJobId != null}
        onOpenChange={(open) => {
          if (!open) {
            setScopeJobId(null);
            setScopeJobTitle(undefined);
          }
        }}
      />
    </PageShell>
  );
}
