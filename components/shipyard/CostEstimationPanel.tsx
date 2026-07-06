"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { ShipyardRfqQueueRow } from "@/lib/db/shipyardRfq";
import type {
  YardCostEstimateVersionSummary,
  YardCostEstimateView,
} from "@/lib/db/yardCostEstimate";
import type { YardCostTemplateSummary } from "@/lib/db/yardCostTemplates";

type LineForm = {
  id: string;
  specLineId: string | null;
  lineSource: string;
  description: string;
  unit: string | null;
  quantity: string;
  labourHours: string;
  labourRate: string;
  materialCost: string;
  equipmentCost: string;
  subcontractCost: string;
  lineTotal: number;
  bucket: string | null;
  lineCode: string | null;
};

function lineFromEstimate(line: YardCostEstimateView["lines"][number]): LineForm {
  return {
    id: line.id,
    specLineId: line.specLineId,
    lineSource: line.lineSource,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity?.toString() ?? "",
    labourHours: line.labourHours?.toString() ?? "",
    labourRate: line.labourRate?.toString() ?? "",
    materialCost: line.materialCost.toString(),
    equipmentCost: line.equipmentCost.toString(),
    subcontractCost: line.subcontractCost.toString(),
    lineTotal: line.lineTotal,
    bucket: line.bucket,
    lineCode: line.lineCode,
  };
}

function computeLineTotal(line: LineForm): number {
  const labour = (Number(line.labourHours) || 0) * (Number(line.labourRate) || 0);
  const material = Number(line.materialCost) || 0;
  const equipment = Number(line.equipmentCost) || 0;
  const subcontract = Number(line.subcontractCost) || 0;
  return labour + material + equipment + subcontract;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

type CostEstimationPanelProps = {
  inviteOptions: ShipyardRfqQueueRow[];
  initialInviteId?: string;
};

export function CostEstimationPanel({ inviteOptions, initialInviteId }: CostEstimationPanelProps) {
  const [inviteId, setInviteId] = useState(initialInviteId ?? inviteOptions[0]?.id ?? "");
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [versions, setVersions] = useState<YardCostEstimateVersionSummary[]>([]);
  const [templates, setTemplates] = useState<YardCostTemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<YardCostEstimateView | null>(null);
  const [projectName, setProjectName] = useState("");
  const [vesselName, setVesselName] = useState<string | null>(null);
  const [lines, setLines] = useState<LineForm[]>([]);
  const [marginPct, setMarginPct] = useState("10");
  const [notes, setNotes] = useState("");
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newVersionTemplateId, setNewVersionTemplateId] = useState("");

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/shipyard/cost-templates");
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(data.templates as YardCostTemplateSummary[]);
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const loadEstimate = useCallback(
    async (id: string, estimateId?: string | null) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const qs = estimateId ? `?estimateId=${encodeURIComponent(estimateId)}` : "";
        const res = await fetch(`/api/shipyard/estimation/${id}${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load estimate");
        const est = data.estimate as YardCostEstimateView;
        setEstimate(est);
        setActiveEstimateId(est.id);
        setVersions(data.versions as YardCostEstimateVersionSummary[]);
        setProjectName(data.project.name);
        setVesselName(data.project.vesselName);
        setLines(est.lines.map(lineFromEstimate));
        setMarginPct(String(est.marginPct ?? 10));
        setNotes(est.notes ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setEstimate(null);
        setLines([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (inviteId) {
      setActiveEstimateId(null);
      void loadEstimate(inviteId);
    }
  }, [inviteId, loadEstimate]);

  const specLines = useMemo(
    () => lines.filter((l) => l.lineSource !== "general_service"),
    [lines],
  );
  const generalLines = useMemo(
    () => lines.filter((l) => l.lineSource === "general_service"),
    [lines],
  );

  const subtotal = useMemo(
    () => lines.reduce((s, line) => s + computeLineTotal(line), 0),
    [lines],
  );
  const grandTotal = useMemo(
    () => subtotal * (1 + (Number(marginPct) || 0) / 100),
    [subtotal, marginPct],
  );

  function lineIndex(lineId: string): number {
    return lines.findIndex((l) => l.id === lineId);
  }

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[index]!, ...patch };
      merged.lineTotal = computeLineTotal(merged);
      next[index] = merged;
      return next;
    });
  }

  async function handleSave(status?: string, extra?: { isSelectedForQuote?: boolean }) {
    if (!inviteId || !estimate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipyard/estimation/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: estimate.id,
          marginPct: Number(marginPct) || 0,
          notes: notes || null,
          status,
          isSelectedForQuote: extra?.isSelectedForQuote,
          lines: lines.map((line, i) => ({
            id: line.id,
            specLineId: line.specLineId,
            description: line.description,
            unit: line.unit,
            quantity: line.quantity ? Number(line.quantity) : null,
            labourHours: line.labourHours ? Number(line.labourHours) : null,
            labourRate: line.labourRate ? Number(line.labourRate) : null,
            materialCost: Number(line.materialCost) || 0,
            equipmentCost: Number(line.equipmentCost) || 0,
            subcontractCost: Number(line.subcontractCost) || 0,
            sortOrder: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const est = data.estimate as YardCostEstimateView;
      setEstimate(est);
      setLines(est.lines.map(lineFromEstimate));
      await loadEstimate(inviteId, est.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyTemplate(templateId: string) {
    if (!inviteId || !estimate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipyard/estimation/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: estimate.id, templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Template apply failed");
      await loadEstimate(inviteId, estimate.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template apply failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVersion() {
    if (!inviteId || !estimate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipyard/estimation/${inviteId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionLabel: newVersionLabel.trim() || undefined,
          templateId: newVersionTemplateId || null,
          cloneFromEstimateId: newVersionTemplateId ? null : estimate.id,
          setSelected: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create version");
      setNewVersionOpen(false);
      setNewVersionLabel("");
      setNewVersionTemplateId("");
      const est = data.estimate as YardCostEstimateView;
      setVersions(data.versions as YardCostEstimateVersionSummary[]);
      await loadEstimate(inviteId, est.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create version");
    } finally {
      setSaving(false);
    }
  }

  function renderLineRow(line: LineForm) {
    const i = lineIndex(line.id);
    return (
      <TableRow key={line.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            {line.lineSource === "general_service" ? (
              <Badge variant="outline" className="text-[10px]">
                GS
              </Badge>
            ) : null}
            <div>
              <div className="text-xs text-muted-foreground">{line.lineCode ?? line.bucket ?? "—"}</div>
              <div className="max-w-xs text-sm">{line.description}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-20"
            value={line.quantity}
            onChange={(e) => updateLine(i, { quantity: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">{line.unit ?? ""}</span>
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-20"
            value={line.labourHours}
            onChange={(e) => updateLine(i, { labourHours: e.target.value })}
          />
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-20"
            value={line.labourRate}
            onChange={(e) => updateLine(i, { labourRate: e.target.value })}
          />
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-24"
            value={line.materialCost}
            onChange={(e) => updateLine(i, { materialCost: e.target.value })}
          />
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-24"
            value={line.equipmentCost}
            onChange={(e) => updateLine(i, { equipmentCost: e.target.value })}
          />
        </TableCell>
        <TableCell>
          <Input
            className="h-8 w-24"
            value={line.subcontractCost}
            onChange={(e) => updateLine(i, { subcontractCost: e.target.value })}
          />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatMoney(computeLineTotal(line), estimate?.currency ?? "USD")}
        </TableCell>
      </TableRow>
    );
  }

  const inviteSelectItems = inviteOptions.map((r) => ({
    value: r.id,
    label: `${r.rfqReference} — ${r.projectName}`,
    searchText: `${r.rfqReference} ${r.projectName} ${r.vesselName ?? ""}`,
  }));

  const templateSelectItems = templates.map((t) => ({
    value: t.id,
    label: t.targetOwnerLabel ? `${t.name} (${t.targetOwnerLabel})` : t.name,
    searchText: `${t.name} ${t.targetOwnerLabel ?? ""}`,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Cost build-up</CardTitle>
            <CardDescription>
              Spec lines + general services — multiple quote versions and owner-specific cost templates.
            </CardDescription>
          </div>
          <div className="min-w-64">
            <SearchableSelect
              items={inviteSelectItems}
              value={inviteId}
              onValueChange={setInviteId}
              placeholder="Select RFQ…"
            />
          </div>
        </CardHeader>
        {projectName ? (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{projectName}</span>
              {vesselName ? <span className="text-muted-foreground">{vesselName}</span> : null}
              {estimate ? <Badge variant="secondary">{estimate.status}</Badge> : null}
              {estimate?.templateName ? (
                <Badge variant="outline">Template: {estimate.templateName}</Badge>
              ) : null}
              <Link href="/shipyard/rfq" className="text-primary hover:underline">
                Back to inbox
              </Link>
            </div>

            {versions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quote versions
                </span>
                {versions.map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant={v.id === activeEstimateId ? "default" : "outline"}
                    onClick={() => void loadEstimate(inviteId, v.id)}
                  >
                    {v.versionLabel}
                    {v.isSelectedForQuote ? " ★" : ""}
                  </Button>
                ))}
                <Button size="sm" variant="secondary" onClick={() => setNewVersionOpen(true)}>
                  + New version
                </Button>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <ActiniumLoadingState label="Loading estimate…" />
      ) : !inviteId ? (
        <p className="text-sm text-muted-foreground">Select an RFQ from the inbox to begin costing.</p>
      ) : (
        <>
          {templates.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost templates</CardTitle>
                <CardDescription>
                  Apply a reusable rate card (e.g. different owner pricing) to the current quote version.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void handleApplyTemplate(t.id)}
                  >
                    {t.name}
                    {t.targetOwnerLabel ? ` · ${t.targetOwnerLabel}` : ""}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">Line item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Labour h</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Subcon</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specLines.length > 0 ? (
                  <>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide">
                        Scope / spec lines
                      </TableCell>
                    </TableRow>
                    {specLines.map(renderLineRow)}
                  </>
                ) : null}
                {generalLines.length > 0 ? (
                  <>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide">
                        General services
                      </TableCell>
                    </TableRow>
                    {generalLines.map(renderLineRow)}
                  </>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commercial roll-up</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="margin">Margin %</Label>
                  <Input
                    id="margin"
                    type="number"
                    value={marginPct}
                    onChange={(e) => setMarginPct(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Assumptions, exclusions, productivity factors…"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Totals — {estimate?.versionLabel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(subtotal, estimate?.currency ?? "USD")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin ({marginPct}%)</span>
                  <span className="tabular-nums">
                    {formatMoney(grandTotal - subtotal, estimate?.currency ?? "USD")}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base">
                  <span className="font-medium">Grand total</span>
                  <span className="tabular-nums font-semibold">
                    {formatMoney(grandTotal, estimate?.currency ?? "USD")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave("draft")} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSave("draft", { isSelectedForQuote: true })}
              disabled={saving}
            >
              Mark for quote ★
            </Button>
            <Button variant="secondary" onClick={() => void handleSave("submitted")} disabled={saving}>
              Submit for approval
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/shipyard/approvals?invite=${inviteId}`} />}
              nativeButton={false}
            >
              Internal approval
            </Button>
          </div>
        </>
      )}

      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New quote version</DialogTitle>
            <DialogDescription>
              Create Quote v{versions.length + 1} — clone the current version or start from a cost template
              for a different owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label htmlFor="version-label">Version label</Label>
              <Input
                id="version-label"
                placeholder={`Quote v${versions.length + 1}`}
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Cost template (optional)</Label>
              <SearchableSelect
                items={[{ value: "", label: "Clone current version" }, ...templateSelectItems]}
                value={newVersionTemplateId}
                onValueChange={setNewVersionTemplateId}
                placeholder="Clone current or pick template…"
              />
            </div>
            <Button onClick={() => void handleCreateVersion()} disabled={saving}>
              Create version
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
