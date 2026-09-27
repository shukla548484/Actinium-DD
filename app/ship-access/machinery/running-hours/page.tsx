"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SortableTableHead } from "@/components/ui/SortableTableHead";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import {
  useClientTable,
  type ComparableValue,
} from "@/hooks/useClientTable";
import type { MachineryAssetDto, RunningHoursEntryDto } from "@/lib/db/vesselMachineryAssets";
import { readResponseJson } from "@/lib/http/readResponseJson";
import { cn } from "@/lib/utils";

type RowDraft = {
  currentHours: string;
  nextDueHours: string;
  nextDueDate: string;
};

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function draftFromAsset(asset: MachineryAssetDto): RowDraft {
  return {
    currentHours: asset.currentRunningHours != null ? String(asset.currentRunningHours) : "",
    nextDueHours: asset.nextDueHours != null ? String(asset.nextDueHours) : "",
    nextDueDate: toDateInput(asset.nextDueDate),
  };
}

function isRowEdited(asset: MachineryAssetDto, draft: RowDraft): boolean {
  const baseline = draftFromAsset(asset);
  return (
    draft.currentHours !== baseline.currentHours ||
    draft.nextDueHours !== baseline.nextDueHours ||
    draft.nextDueDate !== baseline.nextDueDate
  );
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function getAssetSortValue(asset: MachineryAssetDto, key: string): ComparableValue {
  switch (key) {
    case "name":
      return asset.name;
    case "department":
      return asset.department;
    case "currentHours":
      return asset.currentRunningHours;
    case "nextDueHours":
      return asset.nextDueHours;
    case "nextDueDate":
      return asset.nextDueDate ? new Date(asset.nextDueDate) : null;
    default:
      return null;
  }
}

function getEntrySortValue(entry: RunningHoursEntryDto, key: string): ComparableValue {
  switch (key) {
    case "name":
      return entry.machineryName;
    case "department":
      return entry.department;
    case "current":
      return entry.currentHours;
    case "delta":
      return entry.hourDifference;
    case "nextDue":
      return entry.nextDueDate
        ? new Date(entry.nextDueDate)
        : entry.nextDueHours;
    case "enteredBy":
      return entry.enteredBy;
    case "date":
      return new Date(entry.recordedAt);
    default:
      return null;
  }
}

export default function MachineryRunningHoursPage() {
  const ctx = useShipAccessContext();
  const [assets, setAssets] = useState<MachineryAssetDto[]>([]);
  const [entries, setEntries] = useState<RunningHoursEntryDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [nameFilter, setNameFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ctx.vesselId) return;
    setError(null);
    try {
      const [aRes, eRes] = await Promise.all([
        fetch(`/api/ship-access/machinery/assets?vesselId=${ctx.vesselId}`),
        fetch(`/api/ship-access/machinery/running-hours?vesselId=${ctx.vesselId}`),
      ]);
      const aData = await readResponseJson<{ assets?: MachineryAssetDto[]; error?: string }>(aRes);
      const eData = await readResponseJson<{ entries?: RunningHoursEntryDto[]; error?: string }>(eRes);
      if (!aRes.ok || !eRes.ok) {
        setError(aData?.error ?? eData?.error ?? "Failed to load running hours");
        setAssets(aData?.assets ?? []);
        setEntries(eData?.entries ?? []);
        return;
      }
      const nextAssets = aData?.assets ?? [];
      setAssets(nextAssets);
      setEntries(eData?.entries ?? []);
      setDrafts(Object.fromEntries(nextAssets.map((a) => [a.id, draftFromAsset(a)])));
    } catch {
      setError("Failed to load running hours");
    }
  }, [ctx.vesselId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  const latestByAsset = useMemo(() => {
    const map = new Map<string, RunningHoursEntryDto>();
    for (const entry of entries) {
      if (!map.has(entry.machineryAssetId)) {
        map.set(entry.machineryAssetId, entry);
      }
    }
    return map;
  }, [entries]);

  const editedCount = assets.filter((asset) => {
    const draft = drafts[asset.id];
    return draft ? isRowEdited(asset, draft) : false;
  }).length;

  const nameFilterNormalized = nameFilter.trim().toLowerCase();
  const filteredAssets = useMemo(
    () =>
      nameFilterNormalized
        ? assets.filter((asset) => {
            const name = asset.name.toLowerCase();
            const id = (asset.identificationNumber ?? "").toLowerCase();
            return name.includes(nameFilterNormalized) || id.includes(nameFilterNormalized);
          })
        : assets,
    [assets, nameFilterNormalized],
  );

  const assetsTable = useClientTable({
    items: filteredAssets,
    getSortValue: getAssetSortValue,
    defaultSort: { key: "name", direction: "asc" },
    resetKey: nameFilterNormalized,
  });

  const historyTable = useClientTable({
    items: entries,
    getSortValue: getEntrySortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  function updateDraft(assetId: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => {
      const current = prev[assetId] ?? { currentHours: "", nextDueHours: "", nextDueDate: "" };
      return { ...prev, [assetId]: { ...current, ...patch } };
    });
    setSuccess(null);
  }

  async function handleSaveChanges() {
    if (!ctx.vesselId) return;

    const readings: Array<{
      machineryAssetId: string;
      department: string;
      currentHours: number;
      nextDueHours: number | null;
      nextDueDate: string | null;
    }> = [];

    for (const asset of assets) {
      const draft = drafts[asset.id];
      if (!draft || !isRowEdited(asset, draft)) continue;

      const currentHours = parseOptionalInt(draft.currentHours);
      if (currentHours == null || currentHours < 0) {
        setError(`Enter a valid current running hours value for ${asset.name}.`);
        return;
      }

      const nextDueHours = parseOptionalInt(draft.nextDueHours);
      if (draft.nextDueHours.trim() && nextDueHours == null) {
        setError(`Enter a valid next due hours value for ${asset.name}.`);
        return;
      }

      readings.push({
        machineryAssetId: asset.id,
        department: asset.department,
        currentHours,
        nextDueHours,
        nextDueDate: draft.nextDueDate.trim() || null,
      });
    }

    if (readings.length === 0) {
      setError("No changes to save.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/ship-access/machinery/running-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: ctx.vesselId,
          readings,
        }),
      });
      const data = await readResponseJson<{
        error?: string;
        message?: string;
        failed?: Array<{ machineryAssetId: string; error: string }>;
      }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Failed to save running hours");
        return;
      }
      if (data?.failed?.length) {
        setError(
          `Saved with ${data.failed.length} error(s): ${data.failed[0]?.error ?? "Unknown error"}`,
        );
      } else {
        setSuccess(data?.message ?? `Saved ${readings.length} reading(s).`);
      }
      await load();
    } catch {
      setError("Failed to save running hours");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery running hours"
        description="Update current running hours for all active machinery. Edit rows below, then save changes."
        actions={
          <Button
            type="button"
            disabled={busy || !ctx.vesselId || editedCount === 0}
            onClick={() => void handleSaveChanges()}
          >
            {busy ? "Saving…" : editedCount > 0 ? `Save changes (${editedCount})` : "Save changes"}
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter by machinery name"
          className="min-w-[200px] max-w-sm flex-1"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Machinery"
                  columnKey="name"
                  activeKey={assetsTable.sortKey}
                  direction={assetsTable.sortDirection}
                  onSort={assetsTable.toggleSort}
                />
                <SortableTableHead
                  label="Department"
                  columnKey="department"
                  activeKey={assetsTable.sortKey}
                  direction={assetsTable.sortDirection}
                  onSort={assetsTable.toggleSort}
                />
                <SortableTableHead
                  label="Current running hours"
                  columnKey="currentHours"
                  activeKey={assetsTable.sortKey}
                  direction={assetsTable.sortDirection}
                  onSort={assetsTable.toggleSort}
                  className="min-w-[9rem]"
                />
                <SortableTableHead
                  label="Next due hours"
                  columnKey="nextDueHours"
                  activeKey={assetsTable.sortKey}
                  direction={assetsTable.sortDirection}
                  onSort={assetsTable.toggleSort}
                  className="min-w-[8rem]"
                />
                <SortableTableHead
                  label="Next due date"
                  columnKey="nextDueDate"
                  activeKey={assetsTable.sortKey}
                  direction={assetsTable.sortDirection}
                  onSort={assetsTable.toggleSort}
                  className="min-w-[10rem]"
                />
                <TableHead>Last updated</TableHead>
                <TableHead>Entered by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {ctx.loading ? "Loading machinery…" : "No active machinery in the register."}
                  </TableCell>
                </TableRow>
              ) : assetsTable.pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No machinery matches “{nameFilter.trim()}”.
                  </TableCell>
                </TableRow>
              ) : (
                assetsTable.pageItems.map((asset) => {
                  const draft = drafts[asset.id] ?? draftFromAsset(asset);
                  const edited = isRowEdited(asset, draft);
                  const latest = latestByAsset.get(asset.id);
                  return (
                    <TableRow
                      key={asset.id}
                      className={cn(edited && "bg-primary/5")}
                    >
                      <TableCell>
                        <div className="font-medium">{asset.name}</div>
                        {asset.identificationNumber ? (
                          <div className="text-xs text-muted-foreground">
                            {asset.identificationNumber}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{asset.department}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-8"
                          value={draft.currentHours}
                          onChange={(e) => updateDraft(asset.id, { currentHours: e.target.value })}
                          aria-label={`Current running hours for ${asset.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-8"
                          value={draft.nextDueHours}
                          onChange={(e) => updateDraft(asset.id, { nextDueHours: e.target.value })}
                          aria-label={`Next due hours for ${asset.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8"
                          value={draft.nextDueDate}
                          onChange={(e) => updateDraft(asset.id, { nextDueDate: e.target.value })}
                          aria-label={`Next due date for ${asset.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {latest
                          ? new Date(latest.recordedAt).toLocaleString()
                          : asset.currentRunningHours != null
                            ? "—"
                            : "Never"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {latest?.enteredBy ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationBar
        page={assetsTable.page}
        totalPages={assetsTable.totalPages}
        total={assetsTable.total}
        onPageChange={assetsTable.setPage}
      />

      <Accordion>
        <AccordionItem value="history">
          <AccordionTrigger>Recent history ({entries.length})</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          label="Machinery"
                          columnKey="name"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Department"
                          columnKey="department"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Current"
                          columnKey="current"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Δ Hours"
                          columnKey="delta"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Next due"
                          columnKey="nextDue"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Entered by"
                          columnKey="enteredBy"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                        <SortableTableHead
                          label="Date"
                          columnKey="date"
                          activeKey={historyTable.sortKey}
                          direction={historyTable.sortDirection}
                          onSort={historyTable.toggleSort}
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No running hours recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyTable.pageItems.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.machineryName}</TableCell>
                            <TableCell>{e.department}</TableCell>
                            <TableCell>{e.currentHours.toLocaleString()}</TableCell>
                            <TableCell>{e.hourDifference?.toLocaleString() ?? "—"}</TableCell>
                            <TableCell>
                              {e.nextDueDate
                                ? new Date(e.nextDueDate).toLocaleDateString()
                                : (e.nextDueHours ?? "—")}
                            </TableCell>
                            <TableCell>{e.enteredBy}</TableCell>
                            <TableCell>{new Date(e.recordedAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <PaginationBar
                page={historyTable.page}
                totalPages={historyTable.totalPages}
                total={historyTable.total}
                onPageChange={historyTable.setPage}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageShell>
  );
}
