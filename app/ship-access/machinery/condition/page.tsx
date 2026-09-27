"use client";

import { useCallback, useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { ConditionReportDto, MachineryAssetDto } from "@/lib/db/vesselMachineryAssets";
import { readResponseJson } from "@/lib/http/readResponseJson";
import { CONDITION_RATING_ITEMS, conditionRatingLabel } from "@/lib/vessel/machinery/parameters";

function getReportSortValue(report: ConditionReportDto, key: string): ComparableValue {
  switch (key) {
    case "machinery":
      return report.machineryName ?? report.department ?? "General";
    case "rating":
      return conditionRatingLabel(report.overallRating);
    case "summary":
      return report.summary;
    case "reported":
      return new Date(report.reportedAt);
    default:
      return null;
  }
}

export default function MachineryConditionPage() {
  const ctx = useShipAccessContext();
  const [assets, setAssets] = useState<MachineryAssetDto[]>([]);
  const [reports, setReports] = useState<ConditionReportDto[]>([]);
  const [assetId, setAssetId] = useState("");
  const [rating, setRating] = useState("monitor");
  const [summary, setSummary] = useState("");
  const [deficiencies, setDeficiencies] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ctx.vesselId) return;
    const [aRes, rRes] = await Promise.all([
      fetch(`/api/ship-access/machinery/assets?vesselId=${ctx.vesselId}`),
      fetch(`/api/ship-access/machinery/condition?vesselId=${ctx.vesselId}`),
    ]);
    const aData = await readResponseJson<{ assets?: MachineryAssetDto[] }>(aRes);
    const rData = await readResponseJson<{ reports?: ConditionReportDto[] }>(rRes);
    setAssets(aData?.assets ?? []);
    setReports(rData?.reports ?? []);
  }, [ctx.vesselId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  const table = useClientTable({
    items: reports,
    getSortValue: getReportSortValue,
    defaultSort: { key: "reported", direction: "desc" },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.vesselId) return;
    setBusy(true);
    const asset = assets.find((a) => a.id === assetId);
    await fetch("/api/ship-access/machinery/condition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vesselId: ctx.vesselId,
        machineryAssetId: assetId || null,
        department: asset?.department ?? null,
        overallRating: rating,
        summary: summary || null,
        deficiencies: deficiencies || null,
      }),
    });
    setBusy(false);
    setSummary("");
    setDeficiencies("");
    void load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery condition reports"
        description="Traffic-light condition rating — Excellent, Good, Monitor, Poor, Critical."
      />

      <Card className="mb-4">
        <CardContent className="py-4">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void handleSave(e)}>
            <div className="space-y-2">
              <Label>Machinery (optional)</Label>
              <LabeledSelect
                items={[{ value: "", label: "Whole department" }, ...assets.map((a) => ({ value: a.id, label: a.name }))]}
                value={assetId}
                onValueChange={setAssetId}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Overall rating *</Label>
              <LabeledSelect
                items={CONDITION_RATING_ITEMS.map((i) => ({ value: i.value, label: i.label }))}
                value={rating}
                onValueChange={(v) => setRating(v || "monitor")}
                className="w-full"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Summary</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Deficiencies</Label>
              <Textarea value={deficiencies} onChange={(e) => setDeficiencies(e.target.value)} rows={3} />
            </div>
            <Button type="submit" disabled={busy}>Submit report</Button>
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
                  label="Rating"
                  columnKey="rating"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="Summary"
                  columnKey="summary"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
                <SortableTableHead
                  label="Reported"
                  columnKey="reported"
                  activeKey={table.sortKey}
                  direction={table.sortDirection}
                  onSort={table.toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No condition reports yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.pageItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.machineryName ?? r.department ?? "General"}</TableCell>
                    <TableCell>{conditionRatingLabel(r.overallRating)}</TableCell>
                    <TableCell className="max-w-md truncate">{r.summary ?? "—"}</TableCell>
                    <TableCell>{new Date(r.reportedAt).toLocaleDateString()}</TableCell>
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
