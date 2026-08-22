"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import { notify } from "@/lib/notify";

const PAGE_SIZE = 10;

const DEPARTMENT_ITEMS = [
  "Deck",
  "Engine",
  "Electrical",
  "Hull",
  "Machinery",
  "Safety",
  "Catering",
  "Bridge",
  "Other",
].map((value) => ({ value, label: value }));

type DefectRow = {
  id: string;
  department: string;
  defectDetails: string;
  machineryAssociated: string | null;
  requisitionNumber: string | null;
};

type Props = {
  dryDockProjectId: string;
  disabled?: boolean;
  onImported?: () => void;
  onSubmissionSynced?: (submission: InputSubmissionDto) => void;
  onDefectCountChange?: (count: number) => void;
};

export function ProjectDefectsExcelPanel({
  dryDockProjectId,
  disabled,
  onImported,
  onSubmissionSynced,
  onDefectCountChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [department, setDepartment] = useState("");
  const [defectDetails, setDefectDetails] = useState("");
  const [machineryAssociated, setMachineryAssociated] = useState("");
  const [requisitionNumber, setRequisitionNumber] = useState("");

  const total = defects.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const pageRows = useMemo(
    () => defects.slice(rangeStart, rangeStart + PAGE_SIZE),
    [defects, rangeStart],
  );
  const showingFrom = total === 0 ? 0 : rangeStart + 1;
  const showingTo = Math.min(rangeStart + PAGE_SIZE, total);

  const applyDefects = useCallback(
    (next: DefectRow[], opts?: { page?: number }) => {
      setDefects(next);
      setPage(opts?.page ?? 1);
      setLoading(false);
      onDefectCountChange?.(next.length);
    },
    [onDefectCountChange],
  );

  const loadDefects = useCallback(async () => {
    const res = await fetch(`/api/superintendent/projects/${dryDockProjectId}/defects`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { defects?: DefectRow[] };
    applyDefects(data.defects ?? []);
  }, [applyDefects, dryDockProjectId]);

  useEffect(() => {
    void loadDefects();
  }, [loadDefects]);

  function syncSubmission(submission?: InputSubmissionDto | null) {
    if (submission) onSubmissionSynced?.(submission);
    onImported?.();
  }

  async function onDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/defects/template`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        let message = "Template download failed";
        if (type.includes("application/json")) {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } else if (res.status === 401) {
          message = "Unauthorized. Sign in at /login.";
        }
        notify.error(message);
        return;
      }
      const blob = await res.blob();
      const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
      const filename = match?.[1] ?? "defect-import-template.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify.error("Template download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await fetch(`/api/superintendent/projects/${dryDockProjectId}/defects/import`, {
        method: "POST",
        body: fd,
        cache: "no-store",
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        defects?: DefectRow[];
        submission?: InputSubmissionDto | null;
      };
      if (!res.ok) {
        notify.error(data.error ?? "Import failed");
        return;
      }
      if (Array.isArray(data.defects)) {
        applyDefects(data.defects);
      } else {
        await loadDefects();
      }
      syncSubmission(data.submission);
      notify.success(data.message ?? "Defects imported");
      requestAnimationFrame(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      notify.error("Import failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onAdd() {
    if (disabled || adding) return;
    const details = defectDetails.trim();
    if (!department || !details) {
      notify.error("Department and defect details are required.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/superintendent/projects/${dryDockProjectId}/defects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          defectDetails: details,
          machineryAssociated: machineryAssociated.trim() || null,
          requisitionNumber: requisitionNumber.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        defects?: DefectRow[];
        submission?: InputSubmissionDto | null;
      };
      if (!res.ok) {
        notify.error(data.error ?? "Could not add defect");
        return;
      }
      const next = data.defects ?? [];
      applyDefects(next, { page: Math.max(1, Math.ceil(next.length / PAGE_SIZE)) });
      setDepartment("");
      setDefectDetails("");
      setMachineryAssociated("");
      setRequisitionNumber("");
      syncSubmission(data.submission);
      notify.success("Defect added");
      requestAnimationFrame(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      notify.error("Could not add defect");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Defects</CardTitle>
          <CardDescription>
            Add a defect, or download the vessel-prefilled template, fill department and defect
            details, then upload. Photos are not part of this Excel. Rows appear in the table
            below immediately.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => void onDownloadTemplate()}
          >
            {downloading ? "Downloading…" : "Download template"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading || disabled}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Importing…" : "Upload Excel"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="defect-department">Department</Label>
            <LabeledSelect
              id="defect-department"
              className="mt-1.5 min-w-0"
              items={DEPARTMENT_ITEMS}
              value={department}
              onValueChange={setDepartment}
              placeholder="Select department"
              disabled={disabled}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="defect-details">Defect details</Label>
            <Textarea
              id="defect-details"
              className="mt-1.5 min-h-[2.5rem]"
              rows={2}
              value={defectDetails}
              onChange={(e) => setDefectDetails(e.target.value)}
              placeholder="What needs repair or follow-up"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="defect-machinery">Machinery (optional)</Label>
            <Input
              id="defect-machinery"
              className="mt-1.5"
              value={machineryAssociated}
              onChange={(e) => setMachineryAssociated(e.target.value)}
              placeholder="Associated machinery"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="defect-requisition">Requisition no. (optional)</Label>
            <Input
              id="defect-requisition"
              className="mt-1.5"
              value={requisitionNumber}
              onChange={(e) => setRequisitionNumber(e.target.value)}
              placeholder="REQ / PR"
              disabled={disabled}
            />
          </div>
          <div className="flex items-end lg:col-span-3">
            <Button type="button" disabled={disabled || adding} onClick={() => void onAdd()}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>

        <div ref={tableRef} className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading defects…</p>
          ) : (
            <>
              <div className="max-h-[min(28rem,50vh)] overflow-y-auto overflow-x-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[var(--dd-bg-2)]">
                    <TableRow>
                      <TableHead className="w-[8rem]">Department</TableHead>
                      <TableHead>Defect details</TableHead>
                      <TableHead className="w-[12rem]">Machinery</TableHead>
                      <TableHead className="w-[10rem]">Requisition no.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-muted-foreground whitespace-normal">
                          No defects yet. Add a row or upload Excel. Template columns: Department,
                          Defect details, Machinery associated (if any), Requisition number (if any).
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.department}</TableCell>
                          <TableCell className="max-w-[28rem] whitespace-normal">
                            {row.defectDetails}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {row.machineryAssociated || "—"}
                          </TableCell>
                          <TableCell>{row.requisitionNumber || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationBar
                page={safePage}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
                summary={
                  total === 0 ? undefined : `Showing ${showingFrom}–${showingTo} of ${total}`
                }
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
