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
import type { MachineryAssetDto, ParameterEntryDto } from "@/lib/db/vesselMachineryAssets";
import { MACHINERY_PARAMETER_CATALOG } from "@/lib/vessel/machinery/parameters";

export default function MachineryParametersPage() {
  const ctx = useShipAccessContext();
  const [assets, setAssets] = useState<MachineryAssetDto[]>([]);
  const [entries, setEntries] = useState<ParameterEntryDto[]>([]);
  const [assetId, setAssetId] = useState("");
  const [parameterKey, setParameterKey] = useState<string>(MACHINERY_PARAMETER_CATALOG[0]?.key ?? "");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ctx.vesselId) return;
    const [aRes, eRes] = await Promise.all([
      fetch(`/api/ship-access/machinery/assets?vesselId=${ctx.vesselId}`),
      fetch(`/api/ship-access/machinery/parameters?vesselId=${ctx.vesselId}`),
    ]);
    const aData = (await aRes.json()) as { assets?: MachineryAssetDto[] };
    const eData = (await eRes.json()) as { entries?: ParameterEntryDto[] };
    setAssets(aData.assets ?? []);
    setEntries(eData.entries ?? []);
    if (!assetId && aData.assets?.[0]) setAssetId(aData.assets[0].id);
  }, [ctx.vesselId, assetId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.vesselId || !assetId) return;
    setBusy(true);
    const param = MACHINERY_PARAMETER_CATALOG.find((p) => p.key === parameterKey);
    await fetch("/api/ship-access/machinery/parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vesselId: ctx.vesselId,
        machineryAssetId: assetId,
        parameterKey,
        parameterLabel: param?.label ?? parameterKey,
        value,
        unit: param?.unit || null,
      }),
    });
    setBusy(false);
    setValue("");
    void load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery parameters"
        description="Record cylinder temps, pressures, vibration, oil analysis, and power output."
      />

      <Card className="mb-4">
        <CardContent className="py-4">
          <form className="grid gap-4 md:grid-cols-4" onSubmit={(e) => void handleSave(e)}>
            <div className="space-y-2">
              <Label>Machinery</Label>
              <LabeledSelect
                items={assets.map((a) => ({ value: a.id, label: a.name }))}
                value={assetId}
                onValueChange={setAssetId}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Parameter</Label>
              <LabeledSelect
                items={MACHINERY_PARAMETER_CATALOG.map((p) => ({ value: p.key, label: p.label }))}
                value={parameterKey}
                onValueChange={(v) => setParameterKey(v || parameterKey)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>Record</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machinery</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.machineryName}</TableCell>
                  <TableCell>{e.parameterLabel}</TableCell>
                  <TableCell>{e.value}{e.unit ? ` ${e.unit}` : ""}</TableCell>
                  <TableCell>{new Date(e.recordedAt).toLocaleString()}</TableCell>
                  <TableCell>{e.enteredBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
