"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCKING_COST_BUCKET,
  GENERAL_SERVICE_COST_BUCKET,
} from "@/lib/tender/catalogBuckets";
import {
  STANDARD_DOCKING_CATEGORIES,
  formatCategoryLabel,
} from "@/lib/tender/categories";
import type { CalcRule, MasterSpecLine } from "@/lib/tender/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

const CALC_RULES: { value: CalcRule; label: string }[] = [
  { value: "lump_sum", label: "Lump sum" },
  { value: "per_day", label: "Per day" },
  { value: "unit_qty", label: "Unit × qty" },
  { value: "unit_qty_days", label: "Unit × qty × days" },
  { value: "watch", label: "Watch" },
  { value: "connection_daily", label: "Connection daily" },
  { value: "connect_disconnect", label: "Connect / disconnect" },
  { value: "per_m2", label: "Per m²" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: DOCKING_COST_BUCKET, label: "01 Docking Cost" },
  { value: GENERAL_SERVICE_COST_BUCKET, label: "02 General Service Cost" },
  { value: "other", label: "Other categories" },
];

export function MasterCatalogPanel() {
  const [lines, setLines] = useState<MasterSpecLine[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/master-catalog");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load catalog.");
      return;
    }
    setLines(data.lines);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return lines;
    if (filter === "other") {
      return lines.filter(
        (l) => l.bucket !== DOCKING_COST_BUCKET && l.bucket !== GENERAL_SERVICE_COST_BUCKET,
      );
    }
    return lines.filter((l) => l.bucket === filter);
  }, [lines, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, MasterSpecLine[]>();
    for (const line of filtered) {
      const list = map.get(line.bucket) ?? [];
      list.push(line);
      map.set(line.bucket, list);
    }
    return [...map.entries()];
  }, [filtered]);

  async function handleImport(file: File) {
    setImporting(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/master-catalog/import", { method: "POST", body: form });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      return;
    }
    setMessage(
      `Imported ${data.imported} line(s)${data.skipped ? `, skipped ${data.skipped} duplicate(s)` : ""}.`,
    );
    void load();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/master-catalog/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Delete failed.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
    setMessage("Line removed from master catalog.");
    setDeleteTarget(null);
  }

  async function toggleActive(line: MasterSpecLine) {
    const res = await fetch(`/api/admin/master-catalog/${line.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !line.isActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setLines((prev) => prev.map((l) => (l.id === line.id ? data.line : l)));
    }
  }

  if (loading) {
    return <ActiniumLoadingState label="Loading master catalog…" size="sm" />;
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 text-blue-900">
        <AlertDescription>
          Master catalog defines the standard spec lines copied into every new tender project.
          Focus on <strong>01 Docking Cost</strong> and <strong>02 General Service Cost</strong> first;
          additional general services can be added here or bulk-imported from Excel.
        </AlertDescription>
      </Alert>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select items={FILTER_OPTIONS} value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => setShowAdd(true)}>
          + Add line
        </Button>

        <Button
          variant="outline"
          render={<a href="/api/admin/master-catalog/template?mode=empty" />}
          nativeButton={false}
        >
          Download empty template
        </Button>

        <Button
          variant="outline"
          render={<a href="/api/admin/master-catalog/template" />}
          nativeButton={false}
        >
          Download current catalog
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={importing}
          onClick={() => document.getElementById("master-catalog-import")?.click()}
        >
          {importing ? "Importing…" : "Bulk upload Excel"}
        </Button>
        <input
          id="master-catalog-import"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = "";
          }}
        />

        <Badge variant="secondary">{lines.length} master lines</Badge>
      </div>

      {showAdd && (
        <AddMasterLineForm
          onCreated={(line) => {
            setLines((prev) => [...prev, line]);
            setShowAdd(false);
            setMessage("Line added to master catalog.");
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {grouped.map(([bucket, bucketLines]) => (
        <TableCard
          key={bucket}
          title={formatCategoryLabel(
            STANDARD_DOCKING_CATEGORIES.find((c) => c.slug === bucket) ?? {
              categoryNo: "—",
              slug: bucket,
              name: bucket,
              shortcut: "",
            },
          )}
          description={`${bucketLines.length} line(s)`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Calc</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bucketLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs">{line.lineCode ?? "—"}</TableCell>
                  <TableCell>
                    {line.description}
                    {line.isOptional && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Optional
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{line.unit ?? "—"}</TableCell>
                  <TableCell className="text-xs">{line.calcRule}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => void toggleActive(line)}
                    >
                      {line.isActive ? "Active" : "Inactive"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(line.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ))}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete master line?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing projects are not changed. New projects will no longer receive this line.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && void handleDelete(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddMasterLineForm({
  onCreated,
  onCancel,
}: {
  onCreated: (line: MasterSpecLine) => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    bucket: DOCKING_COST_BUCKET,
    lineCode: "",
    description: "",
    unit: "",
    calcRule: "lump_sum" as CalcRule,
    scopeNotes: "",
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

    const res = await fetch("/api/admin/master-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: form.bucket,
        lineCode: form.lineCode || undefined,
        description: form.description,
        unit: form.unit || null,
        calcRule: form.calcRule,
        scopeNotes: form.scopeNotes || null,
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
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader>
        <CardTitle className="text-sm">Add master catalog line</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select
              items={STANDARD_DOCKING_CATEGORIES.map((c) => ({
                value: c.slug,
                label: formatCategoryLabel(c),
              }))}
              value={form.bucket}
              onValueChange={(v) => v && setForm({ ...form, bucket: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_DOCKING_CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {formatCategoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <Input
              value={form.lineCode}
              onChange={(e) => setForm({ ...form, lineCode: e.target.value })}
              placeholder="e.g. GS-007"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Description *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Calc rule</Label>
            <Select
              items={CALC_RULES}
              value={form.calcRule}
              onValueChange={(v) => v && setForm({ ...form, calcRule: v as CalcRule })}
            >
              <SelectTrigger>
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
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Scope notes</Label>
            <Textarea
              value={form.scopeNotes}
              onChange={(e) => setForm({ ...form, scopeNotes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="col-span-full flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add to catalog"}
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
