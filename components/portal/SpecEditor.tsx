"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCategoryLabel } from "@/lib/tender/categories";
import { TableCard } from "@/components/layout/TableCard";
import type { CalcRule, SpecLine, ProjectCategory } from "@/lib/tender/types";

interface Props {
  projectId: string;
  specLines: SpecLine[];
  categories: ProjectCategory[];
  onUpdated?: () => void;
}

const CALC_RULES: { value: CalcRule; label: string }[] = [
  { value: "lump_sum", label: "Lump sum" },
  { value: "per_day", label: "Per day" },
  { value: "unit_qty", label: "Unit × qty" },
  { value: "unit_qty_days", label: "Unit × qty × days" },
  { value: "watch", label: "Watch (shift)" },
  { value: "connection_daily", label: "Connection daily" },
  { value: "connect_disconnect", label: "Connect / disconnect" },
  { value: "per_m2", label: "Per m²" },
];

export function SpecEditor({ projectId, specLines, categories, onUpdated }: Props) {
  const [lines, setLines] = useState(specLines);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const updateLine = useCallback((id: string, patch: Partial<SpecLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.descriptions) {
          next.descriptions = { ...line.descriptions, ...patch.descriptions };
        }
        return next;
      }),
    );
  }, []);

  async function saveLine(line: SpecLine) {
    setSaving(line.id);
    setMessage(null);

    const res = await fetch(`/api/projects/${projectId}/spec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineId: line.id,
        description: line.description,
        descriptionZh: line.descriptions.zh,
        descriptionJa: line.descriptions.ja,
        unit: line.unit,
        defaultQty: line.defaultQty,
        scopeDays: line.scopeDays,
        scopeAreaM2: line.scopeAreaM2,
        scopeNotes: line.scopeNotes,
        ownerLocked: line.ownerLocked,
        allowDiscount: line.allowDiscount,
        maxDiscountPct: line.maxDiscountPct,
        referenceUnitRate: line.referenceUnitRate,
        isOptional: line.isOptional,
      }),
    });

    setSaving(null);
    if (!res.ok) {
      const data = await res.json();
      setMessage({ text: data.error ?? "Save failed.", type: "error" });
      return;
    }
    setMessage({ text: "Spec line saved.", type: "success" });
    onUpdated?.();
  }

  async function deleteLine(lineId: string) {
    setSaving(lineId);
    const res = await fetch(`/api/projects/${projectId}/spec?lineId=${lineId}`, {
      method: "DELETE",
    });
    setSaving(null);
    setDeleteTarget(null);
    if (!res.ok) {
      setMessage({ text: "Failed to delete.", type: "error" });
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    setMessage({ text: "Spec line deleted.", type: "success" });
    onUpdated?.();
  }

  const grouped = lines.reduce<Record<string, SpecLine[]>>((acc, line) => {
    (acc[line.bucket] ??= []).push(line);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription>
            Define the complete scope here — quantities, days, areas, job notes, and reference rates.
            Shipyards will only enter unit rates and discounts on the portal.
          </AlertDescription>
        </Alert>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            render={<a href={`/api/projects/${projectId}/spec/template?mode=empty`} />}
            nativeButton={false}
          >
            Download template
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/projects/${projectId}/spec/template`} />}
            nativeButton={false}
          >
            Export spec
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            Import Excel
          </Button>
          <Button onClick={() => setShowAddForm(true)}>+ Add Spec Line</Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spec line?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this spec line? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && void deleteLine(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showAddForm && (
        <AddSpecLineForm
          projectId={projectId}
          categories={categories}
          onCreated={(line) => {
            setLines((prev) => [...prev, line]);
            setShowAddForm(false);
            setMessage({ text: "New spec line added.", type: "success" });
            onUpdated?.();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showImport && (
        <ImportSpecForm
          projectId={projectId}
          onImported={() => {
            setShowImport(false);
            setMessage({ text: "Excel import complete. Refreshing…", type: "success" });
            onUpdated?.();
          }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {Object.entries(grouped).map(([bucket, bucketLines]) => (
        <TableCard
          key={bucket}
          title={formatCategoryLabel(
            categories.find((c) => c.slug === bucket) ?? {
              categoryNo: "—",
              slug: bucket,
              name: bucket,
              shortcut: "",
            },
          )}
          description={`${bucketLines.length} line${bucketLines.length !== 1 ? "s" : ""}`}
        >
          <div className="divide-y">
            {bucketLines.map((line) => (
              <SpecLineRow
                key={line.id}
                line={line}
                saving={saving === line.id}
                onChange={(patch) => updateLine(line.id, patch)}
                onSave={() => saveLine(line)}
                onDelete={() => setDeleteTarget(line.id)}
              />
            ))}
          </div>
        </TableCard>
      ))}

      <p className="text-center text-xs text-muted-foreground">
        {lines.length} spec line{lines.length !== 1 ? "s" : ""} across{" "}
        {Object.keys(grouped).length} bucket
        {Object.keys(grouped).length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function AddSpecLineForm({
  projectId,
  categories,
  onCreated,
  onCancel,
}: {
  projectId: string;
  categories: ProjectCategory[];
  onCreated: (line: SpecLine) => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    bucket: categories[0]?.slug ?? "miscellaneous",
    lineCode: "",
    description: "",
    descriptionZh: "",
    descriptionJa: "",
    unit: "",
    defaultQty: "",
    calcRule: "lump_sum" as CalcRule,
    scopeNotes: "",
    referenceUnitRate: "",
    maxDiscountPct: "",
    isOptional: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: form.bucket,
        lineCode: form.lineCode || undefined,
        description: form.description,
        descriptionZh: form.descriptionZh || null,
        descriptionJa: form.descriptionJa || null,
        unit: form.unit || null,
        defaultQty: form.defaultQty ? Number(form.defaultQty) : null,
        calcRule: form.calcRule,
        scopeNotes: form.scopeNotes || null,
        referenceUnitRate: form.referenceUnitRate ? Number(form.referenceUnitRate) : null,
        maxDiscountPct: form.maxDiscountPct ? Number(form.maxDiscountPct) : null,
        isOptional: form.isOptional,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create.");
      return;
    }
    const { line } = await res.json();
    onCreated(line);
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="text-sm">Add new spec line</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                items={categories.map((c) => ({
                  value: c.slug,
                  label: formatCategoryLabel(c),
                }))}
                value={form.bucket}
                onValueChange={(v) => {
                  if (v) setForm({ ...form, bucket: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {formatCategoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Calc rule</Label>
              <Select
                items={CALC_RULES}
                value={form.calcRule}
                onValueChange={(v) => setForm({ ...form, calcRule: v as CalcRule })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALC_RULES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-line-code">Line code</Label>
              <Input
                id="add-line-code"
                value={form.lineCode}
                onChange={(e) => setForm({ ...form, lineCode: e.target.value })}
                placeholder="e.g. GS-007"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-unit">Unit</Label>
              <Input
                id="add-unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g. day, m², connection"
              />
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="add-desc-en">Description (EN) *</Label>
              <Input
                id="add-desc-en"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc-zh">中文</Label>
              <Input
                id="add-desc-zh"
                value={form.descriptionZh}
                onChange={(e) => setForm({ ...form, descriptionZh: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc-ja">日本語</Label>
              <Input
                id="add-desc-ja"
                value={form.descriptionJa}
                onChange={(e) => setForm({ ...form, descriptionJa: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="add-qty">Default qty</Label>
              <Input
                id="add-qty"
                type="number"
                value={form.defaultQty}
                onChange={(e) => setForm({ ...form, defaultQty: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-ref-rate">Ref. unit rate</Label>
              <Input
                id="add-ref-rate"
                type="number"
                value={form.referenceUnitRate}
                onChange={(e) => setForm({ ...form, referenceUnitRate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-discount">Max discount %</Label>
              <Input
                id="add-discount"
                type="number"
                value={form.maxDiscountPct}
                onChange={(e) => setForm({ ...form, maxDiscountPct: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="add-optional"
                checked={form.isOptional}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isOptional: checked === true })
                }
              />
              <Label htmlFor="add-optional" className="text-xs font-normal">
                Optional line
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-scope-notes">Scope notes (shown to yard)</Label>
            <Textarea
              id="add-scope-notes"
              value={form.scopeNotes}
              onChange={(e) => setForm({ ...form, scopeNotes: e.target.value })}
              rows={2}
              placeholder="What is included in this line item…"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add Line"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SpecLineRow({
  line,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  line: SpecLine;
  saving: boolean;
  onChange: (patch: Partial<SpecLine>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAreaLine = line.calcRule === "per_m2";

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                title={expanded ? "Collapse" : "Expand"}
              />
            }
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d={expanded ? "M4 10L8 6L12 10" : "M6 4L10 8L6 12"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </CollapsibleTrigger>
          <span className="font-mono text-xs text-muted-foreground">
            {line.lineCode ?? "—"}
          </span>
          <Badge variant="secondary">{line.calcRule}</Badge>
          <span className="flex-1 truncate text-sm">{line.description}</span>
          {line.isOptional && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Optional
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            disabled={saving}
            title="Delete line"
            className="text-muted-foreground hover:text-destructive"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 4H11.5M5 4V3C5 2.448 5.448 2 6 2H8C8.552 2 9 2.448 9 3V4M6 6.5V10M8 6.5V10M3.5 4L4 11C4 11.552 4.448 12 5 12H9C9.552 12 10 11.552 10 11L10.5 4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>

        <CollapsibleContent className="space-y-3 pl-6">
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Description (EN)</Label>
              <Textarea
                value={line.description}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>中文</Label>
              <Textarea
                value={line.descriptions.zh ?? ""}
                onChange={(e) =>
                  onChange({ descriptions: { ...line.descriptions, zh: e.target.value || null } })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>日本語</Label>
              <Textarea
                value={line.descriptions.ja ?? ""}
                onChange={(e) =>
                  onChange({ descriptions: { ...line.descriptions, ja: e.target.value || null } })
                }
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scope / job details (shown to yard)</Label>
            <Textarea
              value={line.scopeNotes ?? ""}
              onChange={(e) => onChange({ scopeNotes: e.target.value || null })}
              rows={2}
              placeholder="What work is included, assumptions, owner-supplied items…"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input
                value={line.unit ?? ""}
                onChange={(e) => onChange({ unit: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Scope qty</Label>
              <Input
                type="number"
                value={line.defaultQty ?? ""}
                onChange={(e) =>
                  onChange({ defaultQty: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Scope days</Label>
              <Input
                type="number"
                value={line.scopeDays ?? ""}
                onChange={(e) =>
                  onChange({ scopeDays: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Uses project days if blank"
              />
            </div>
            {isAreaLine && (
              <div className="space-y-2">
                <Label>Area m²</Label>
                <Input
                  type="number"
                  value={line.scopeAreaM2 ?? ""}
                  onChange={(e) =>
                    onChange({ scopeAreaM2: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Ref. unit rate</Label>
              <Input
                type="number"
                value={line.referenceUnitRate ?? ""}
                onChange={(e) =>
                  onChange({
                    referenceUnitRate: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Owner budget"
              />
            </div>
            <div className="space-y-2">
              <Label>Max discount %</Label>
              <Input
                type="number"
                value={line.maxDiscountPct ?? ""}
                onChange={(e) =>
                  onChange({ maxDiscountPct: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`allow-discount-${line.id}`}
                  checked={line.allowDiscount}
                  onCheckedChange={(checked) =>
                    onChange({ allowDiscount: checked === true })
                  }
                />
                <Label htmlFor={`allow-discount-${line.id}`} className="text-xs font-normal">
                  Allow yard discount
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`optional-${line.id}`}
                  checked={line.isOptional}
                  onCheckedChange={(checked) =>
                    onChange({ isOptional: checked === true })
                  }
                />
                <Label htmlFor={`optional-${line.id}`} className="text-xs font-normal">
                  Optional
                </Label>
              </div>
            </div>
            <Button type="button" size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save line"}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ImportSpecForm({
  projectId,
  onImported,
  onCancel,
}: {
  projectId: string;
  onImported: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    importedLines: string[];
    skippedLines: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`/api/projects/${projectId}/spec/import`, {
      method: "POST",
      body: form,
    });

    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Import failed.");
      return;
    }
    const data = await res.json();
    setResult(data);
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="text-sm">Import spec lines from Excel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Upload an .xlsx or .xls file with columns: <strong>Code</strong>, <strong>Description</strong>,
          <strong> Bucket</strong> (docking/general/utilities/hull_prep/hull_paint/steel/machinery/other),
          <strong> Unit</strong>, <strong>Qty</strong>, <strong>Days</strong>, <strong>Area</strong>,
          <strong> Calc Rule</strong> (lump_sum/per_day/unit_qty/per_m2/…), <strong>Ref Rate</strong>,
          <strong> Max Discount</strong>, <strong>Notes</strong>, <strong>中文</strong>, <strong>日本語</strong>.
          Existing line codes will be skipped.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose File"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {result && (
          <Card>
            <CardContent className="space-y-1 pt-4 text-sm">
              <p className="font-medium text-emerald-800">
                Imported {result.imported} line{result.imported !== 1 ? "s" : ""}
                {result.skipped > 0 && `, skipped ${result.skipped} (duplicate codes)`}
              </p>
              {result.importedLines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Added: {result.importedLines.join(", ")}
                </p>
              )}
              {result.skippedLines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Skipped: {result.skippedLines.join(", ")}
                </p>
              )}
              <Button type="button" size="sm" className="mt-2" onClick={onImported}>
                Done — Refresh list
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
