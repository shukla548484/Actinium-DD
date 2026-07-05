"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JOB_CATALOG_FIELD_COUNTS } from "@/lib/jobs/catalogSchema";

type SheetStats = {
  sheetNo: number;
  sheetKey: string;
  sheetName: string;
  tableName: string;
  fieldCount: number;
  rowCount: number;
};

type CatalogResponse = {
  stats?: {
    libraryVersion: string | null;
    seeded: boolean;
    sheets: SheetStats[];
    totals: { tables: number; rows: number; spreadsheetFields: number };
  };
  templates?: Array<{
    templateId: string;
    templateName: string;
    templateCategory: string;
    version: string;
    activeFlag: boolean;
    _count: {
      measurements: number;
      checklistItems: number;
      scopeSteps: number;
      attachmentRequirements: number;
      masterJobs: number;
    };
  }>;
  masterJobs?: Array<{
    jobId: string;
    standardJobName: string;
    machinery: string;
    component: string;
    templateId: string;
    riskLevel: string;
    activeFlag: boolean;
  }>;
  seeded?: boolean;
};

type ImportResponse = {
  ok?: boolean;
  error?: string;
  libraryVersion?: string | null;
  diff?: {
    previousMasterJobs: number;
    previousTemplates: number;
    curatedMasterJobs: number;
    curatedTemplates: number;
  };
  imported?: {
    masterJobs: number;
    templates: number;
    measurements: number;
    checklistItems: number;
    scopeSteps: number;
    spareMappings: number;
  };
  validation?: {
    errors: Array<{ sheet: string; row?: number; message: string }>;
  };
};

export function JobCatalogPanel() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    void fetch("/api/admin/job-catalog")
      .then((r) => r.json())
      .then((d: CatalogResponse) => setData(d));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function syncCatalog() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/job-catalog", { method: "POST" });
    const body = (await res.json()) as {
      templates?: number;
      masterJobs?: number;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Sync failed");
      return;
    }
    setMsg(`Synced ${body.templates ?? 0} templates and ${body.masterJobs ?? 0} master jobs.`);
    load();
  }

  async function importWorkbook(file: File) {
    setImportBusy(true);
    setMsg(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "replace");

    const res = await fetch("/api/admin/job-catalog/import", {
      method: "POST",
      body: formData,
    });
    const body = (await res.json()) as ImportResponse;
    setImportBusy(false);

    if (!res.ok) {
      const firstError = body.validation?.errors?.[0];
      const detail = firstError
        ? `${firstError.sheet}${firstError.row ? ` row ${firstError.row}` : ""}: ${firstError.message}`
        : body.error;
      setMsg(detail ?? "Import failed");
      return;
    }

    const diff = body.diff;
    const imported = body.imported;
    setMsg(
      `Imported ${imported?.masterJobs ?? 0} curated jobs (${diff?.previousMasterJobs ?? 0} → ${diff?.curatedMasterJobs ?? 0}) · ` +
        `${imported?.templates ?? 0} templates · version ${body.libraryVersion ?? "unknown"}`,
    );
    load();
  }

  if (!data?.stats) {
    return <p className="text-sm text-muted-foreground">Loading job catalog…</p>;
  }

  const { stats, templates = [], masterJobs = [] } = data;

  return (
    <div className="space-y-6">
      {msg ? (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Job catalog database</CardTitle>
            <CardDescription>
              {stats.totals.spreadsheetFields} spreadsheet fields across {stats.totals.tables} tables ·{" "}
              {stats.totals.rows} rows loaded
              {stats.libraryVersion ? ` · version ${stats.libraryVersion}` : ""}
              {" · "}
              Upload <span className="font-mono text-xs">Actinium_SM_MTIL_Phase_1_Main_Propulsion_v0.4.xlsx</span> to
              replace generated jobs with curated library rows.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={stats.seeded ? "default" : "secondary"}>
              {stats.seeded ? "Seeded" : "Empty"}
            </Badge>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importWorkbook(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="default"
              disabled={importBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {importBusy ? "Importing…" : "Import Phase 1 Excel"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void syncCatalog()}>
              {busy ? "Syncing…" : "Sync generated matrix"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/admin/job-library" />}
              nativeButton={false}
            >
              Job library tree
            </Button>
          </div>
        </CardHeader>
      </Card>

      <TableCard title="Spreadsheet tabs (01–09 + Lists)" description="Field counts match workbook schema.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Sheet</TableHead>
              <TableHead>Table</TableHead>
              <TableHead className="text-right">Fields</TableHead>
              <TableHead className="text-right">Rows</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.sheets.map((sheet) => (
              <TableRow key={sheet.sheetKey}>
                <TableCell className="text-muted-foreground">{sheet.sheetNo}</TableCell>
                <TableCell className="font-medium">{sheet.sheetName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{sheet.tableName}</TableCell>
                <TableCell className="text-right tabular-nums">{sheet.fieldCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Badge variant={sheet.rowCount > 0 ? "default" : "outline"}>{sheet.rowCount}</Badge>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {Object.values(JOB_CATALOG_FIELD_COUNTS).reduce((a, b) => a + b, 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{stats.totals.rows}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <TableCard title="Dynamic templates" description="Tab 02 — drives runtime form generation.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Child rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No templates — run Sync Phase 1 to DB.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.templateId}>
                    <TableCell className="font-mono text-xs">{t.templateId}</TableCell>
                    <TableCell>{t.templateName}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {t._count.measurements}m · {t._count.checklistItems}c · {t._count.scopeSteps}s ·{" "}
                      {t._count.masterJobs}j
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>

        <TableCard title="Master jobs" description="Tab 01 — standard job library rows.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Template</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {masterJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No master jobs — run Sync Phase 1 to DB.
                  </TableCell>
                </TableRow>
              ) : (
                masterJobs.slice(0, 15).map((j) => (
                  <TableRow key={j.jobId}>
                    <TableCell className="font-mono text-xs">{j.jobId}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{j.standardJobName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{j.templateId}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
}
