"use client";

import { useCallback, useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MachineryAssetDto, RunningHoursEntryDto } from "@/lib/db/vesselMachineryAssets";

export default function MachineryRunningHoursPage() {
  const ctx = useShipAccessContext();
  const [assets, setAssets] = useState<MachineryAssetDto[]>([]);
  const [entries, setEntries] = useState<RunningHoursEntryDto[]>([]);
  const [assetId, setAssetId] = useState("");
  const [department, setDepartment] = useState("Machinery");
  const [currentHours, setCurrentHours] = useState("");
  const [nextDueHours, setNextDueHours] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ctx.vesselId) return;
    const [aRes, eRes] = await Promise.all([
      fetch(`/api/ship-access/machinery/assets?vesselId=${ctx.vesselId}`),
      fetch(`/api/ship-access/machinery/running-hours?vesselId=${ctx.vesselId}`),
    ]);
    const aData = (await aRes.json()) as { assets?: MachineryAssetDto[] };
    const eData = (await eRes.json()) as { entries?: RunningHoursEntryDto[] };
    setAssets(aData.assets ?? []);
    setEntries(eData.entries ?? []);
    if (!assetId && aData.assets?.[0]) {
      setAssetId(aData.assets[0].id);
      setDepartment(aData.assets[0].department);
    }
  }, [ctx.vesselId, assetId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.vesselId || !assetId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ship-access/machinery/running-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vesselId: ctx.vesselId,
        machineryAssetId: assetId,
        department,
        currentHours: Number.parseInt(currentHours, 10),
        nextDueHours: nextDueHours ? Number.parseInt(nextDueHours, 10) : null,
        nextDueDate: nextDueDate || null,
      }),
    });
    setBusy(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    setCurrentHours("");
    void load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery running hours"
        description="Record running hours by department, machinery, and component with due tracking."
      />

      <Card className="mb-4">
        <CardContent className="py-4">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={(e) => void handleSave(e)}>
            <div className="space-y-2">
              <Label>Machinery</Label>
              <LabeledSelect
                items={assets.map((a) => ({ value: a.id, label: `${a.name} (${a.department})` }))}
                value={assetId}
                onValueChange={(v) => {
                  setAssetId(v);
                  const asset = assets.find((a) => a.id === v);
                  if (asset) setDepartment(asset.department);
                }}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Current running hours *</Label>
              <Input type="number" value={currentHours} onChange={(e) => setCurrentHours(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Next due hours</Label>
              <Input type="number" value={nextDueHours} onChange={(e) => setNextDueHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next due date</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy || !ctx.vesselId}>
                {busy ? "Saving…" : "Record hours"}
              </Button>
            </div>
          </form>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machinery</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Δ Hours</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Entered by</TableHead>
                <TableHead>Date</TableHead>
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
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.machineryName}</TableCell>
                    <TableCell>{e.department}</TableCell>
                    <TableCell>{e.currentHours.toLocaleString()}</TableCell>
                    <TableCell>{e.hourDifference?.toLocaleString() ?? "—"}</TableCell>
                    <TableCell>
                      {e.nextDueDate ? new Date(e.nextDueDate).toLocaleDateString() : e.nextDueHours ?? "—"}
                    </TableCell>
                    <TableCell>{e.enteredBy}</TableCell>
                    <TableCell>{new Date(e.recordedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
