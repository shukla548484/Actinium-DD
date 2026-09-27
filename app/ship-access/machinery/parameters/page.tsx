"use client";

import { useCallback, useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SortableTableHead } from "@/components/ui/SortableTableHead";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import {
  useClientTable,
  type ComparableValue,
} from "@/hooks/useClientTable";
import type { MachineryAssetDto, ParameterEntryDto } from "@/lib/db/vesselMachineryAssets";
import { readResponseJson } from "@/lib/http/readResponseJson";
import { MACHINERY_PARAMETER_CATALOG } from "@/lib/vessel/machinery/parameters";

function getEntrySortValue(entry: ParameterEntryDto, key: string): ComparableValue {
  switch (key) {
    case "machinery":
      return entry.machineryName;
    case "parameter":
      return entry.parameterLabel;
    case "value":
      return entry.value;
    case "recorded":
      return new Date(entry.recordedAt);
    case "by":
      return entry.enteredBy;
    default:
      return null;
  }
}

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
    const aData = await readResponseJson<{ assets?: MachineryAssetDto[] }>(aRes);
    const eData = await readResponseJson<{ entries?: ParameterEntryDto[] }>(eRes);
    setAssets(aData?.assets ?? []);
    setEntries(eData?.entries ?? []);
    if (!assetId && aData?.assets?.[0]) setAssetId(aData.assets[0].id);
  }, [ctx.vesselId, assetId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  const table = useClientTable({
    items: entries,
    getSortValue: getEntrySortValue,
    defaultSort: { key: "recorded", direction: "desc" },
  });

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
                <SortableTableHead
                  label="Machinery"
                  columnKey="machinery"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="Parameter"
                  columnKey="parameter"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="Value"
                  columnKey="value"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="Recorded"
                  columnKey="recorded"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="By"
                  columnKey="by"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No parameter readings yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.pageItems.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.machineryName}</TableCell>
                    <TableCell>{e.parameterLabel}</TableCell>
                    <TableCell>{e.value}{e.unit ? ` ${e.unit}` : ""}</TableCell>
                    <TableCell>{new Date(e.recordedAt).toLocaleString()}</TableCell>
                    <TableCell>{e.enteredBy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationBar
        page={table.page}
        totalPages={table.totalPages}
        total={table.total}
        onPageChange={table.setPage}
      />
    </PageShell>
  );
}
