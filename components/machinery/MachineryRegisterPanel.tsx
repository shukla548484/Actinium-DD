"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { MachineryAssetDto } from "@/lib/db/vesselMachineryAssets";
import { readResponseJson } from "@/lib/http/readResponseJson";
import {
  MACHINERY_REGISTER_DEPARTMENTS,
  machineryDuplicateKey,
  validateMachineryImportRow,
  type MachineryRegisterImportRow,
} from "@/lib/machinery/machineryRegisterImport";
import { notify } from "@/lib/notify";

const DEPARTMENTS = MACHINERY_REGISTER_DEPARTMENTS.map((value) => ({
  value,
  label: value,
}));

export type MachineryRegisterPanelProps = {
  /** Vessel id for ship-access; optional when office scopes via dryDockProjectId. */
  vesselId?: string | null;
  dryDockProjectId?: string | null;
  /** "ship" → /api/ship-access/machinery/assets ; "office" → /api/superintendent/machinery-assets */
  side: "ship" | "office";
};

type FormState = {
  name: string;
  department: string;
  maker: string;
  model: string;
  serialNumber: string;
  units: string;
  location: string;
  notes: string;
  isActive: boolean;
};

type ReviewRow = MachineryRegisterImportRow & {
  localId: string;
  skip: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  department: "Machinery",
  maker: "",
  model: "",
  serialNumber: "",
  units: "",
  location: "",
  notes: "",
  isActive: true,
});

function listUrl(side: "ship" | "office", vesselId?: string | null, dryDockProjectId?: string | null) {
  if (side === "ship") {
    const qs = new URLSearchParams();
    if (vesselId) qs.set("vesselId", vesselId);
    qs.set("includeInactive", "1");
    return `/api/ship-access/machinery/assets?${qs.toString()}`;
  }
  const qs = new URLSearchParams();
  if (dryDockProjectId) qs.set("dryDockProjectId", dryDockProjectId);
  else if (vesselId) qs.set("vesselId", vesselId);
  qs.set("includeInactive", "1");
  return `/api/superintendent/machinery-assets?${qs.toString()}`;
}

function itemUrl(
  side: "ship" | "office",
  id: string,
  vesselId?: string | null,
  dryDockProjectId?: string | null,
) {
  if (side === "ship") {
    const qs = vesselId ? `?vesselId=${encodeURIComponent(vesselId)}` : "";
    return `/api/ship-access/machinery/assets/${id}${qs}`;
  }
  const qs = new URLSearchParams();
  if (dryDockProjectId) qs.set("dryDockProjectId", dryDockProjectId);
  else if (vesselId) qs.set("vesselId", vesselId);
  const q = qs.toString();
  return `/api/superintendent/machinery-assets/${id}${q ? `?${q}` : ""}`;
}

function createUrl(side: "ship" | "office") {
  return side === "ship"
    ? "/api/ship-access/machinery/assets"
    : "/api/superintendent/machinery-assets";
}

function templateUrl(
  side: "ship" | "office",
  vesselId?: string | null,
  dryDockProjectId?: string | null,
) {
  if (side === "ship") {
    const qs = vesselId ? `?vesselId=${encodeURIComponent(vesselId)}` : "";
    return `/api/ship-access/machinery/assets/template${qs}`;
  }
  const qs = new URLSearchParams();
  if (dryDockProjectId) qs.set("dryDockProjectId", dryDockProjectId);
  else if (vesselId) qs.set("vesselId", vesselId);
  const q = qs.toString();
  return `/api/superintendent/machinery-assets/template${q ? `?${q}` : ""}`;
}

function parseImportUrl(side: "ship" | "office") {
  return side === "ship"
    ? "/api/ship-access/machinery/assets/parse-import"
    : "/api/superintendent/machinery-assets/parse-import";
}

function batchUrl(side: "ship" | "office") {
  return side === "ship"
    ? "/api/ship-access/machinery/assets/batch"
    : "/api/superintendent/machinery-assets/batch";
}

function newLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MachineryRegisterPanel({
  vesselId,
  dryDockProjectId,
  side,
}: MachineryRegisterPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MachineryAssetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);

  const scoped = side === "ship" ? Boolean(vesselId) : Boolean(dryDockProjectId || vesselId);

  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of assets) {
      keys.add(machineryDuplicateKey(a.name, a.serialNumber ?? ""));
    }
    return keys;
  }, [assets]);

  const reviewValidated = useMemo(() => {
    if (!reviewRows) return [];
    const draftCounts = new Map<string, number>();
    for (const row of reviewRows) {
      if (row.skip) continue;
      const key = machineryDuplicateKey(row.name, row.serialNumber);
      draftCounts.set(key, (draftCounts.get(key) ?? 0) + 1);
    }
    return reviewRows.map((row) => {
      const draftKeys = new Set<string>();
      const key = machineryDuplicateKey(row.name, row.serialNumber);
      if (!row.skip && (draftCounts.get(key) ?? 0) > 1) draftKeys.add(key);
      const { errors, warnings } = validateMachineryImportRow(row, {
        existingKeys,
        draftKeys,
      });
      return { row, errors, warnings };
    });
  }, [reviewRows, existingKeys]);

  const reviewBlocking = useMemo(
    () =>
      reviewValidated.some(
        ({ row, errors }) => !row.skip && errors.length > 0,
      ),
    [reviewValidated],
  );

  const confirmableCount = useMemo(
    () => reviewValidated.filter(({ row, errors }) => !row.skip && errors.length === 0).length,
    [reviewValidated],
  );

  const load = useCallback(async () => {
    if (!scoped) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl(side, vesselId, dryDockProjectId));
      const data = await readResponseJson<{ assets?: MachineryAssetDto[]; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Failed to load machinery register");
        setAssets([]);
        return;
      }
      setAssets(data?.assets ?? []);
    } finally {
      setLoading(false);
    }
  }, [scoped, side, vesselId, dryDockProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPhotoFile(null);
    setExistingPhotoUrl(null);
    setClearPhoto(false);
    setShowForm(true);
    setError(null);
  }

  function openEdit(asset: MachineryAssetDto) {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      department: asset.department || "Machinery",
      maker: asset.maker ?? "",
      model: asset.model ?? "",
      serialNumber: asset.serialNumber ?? "",
      units: asset.units ?? "",
      location: asset.location ?? "",
      notes: asset.notes ?? "",
      isActive: asset.isActive,
    });
    setPhotoFile(null);
    setExistingPhotoUrl(asset.nameplatePhotoUrl);
    setClearPhoto(false);
    setShowForm(true);
    setError(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setPhotoFile(null);
    setExistingPhotoUrl(null);
    setClearPhoto(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scoped || !form.name.trim()) return;
    setBusy(true);
    setError(null);

    const body = new FormData();
    if (vesselId) body.set("vesselId", vesselId);
    if (dryDockProjectId) body.set("dryDockProjectId", dryDockProjectId);
    body.set("name", form.name.trim());
    body.set("department", form.department);
    body.set("maker", form.maker);
    body.set("model", form.model);
    body.set("serialNumber", form.serialNumber);
    body.set("units", form.units);
    body.set("location", form.location);
    body.set("notes", form.notes);
    body.set("isActive", form.isActive ? "true" : "false");
    if (photoFile) body.set("nameplatePhoto", photoFile);
    if (clearPhoto) body.set("clearNameplatePhoto", "1");

    try {
      const res = editingId
        ? await fetch(itemUrl(side, editingId, vesselId, dryDockProjectId), {
            method: "PATCH",
            body,
          })
        : await fetch(createUrl(side), { method: "POST", body });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      cancelForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(asset: MachineryAssetDto) {
    if (!confirm(`Delete machinery "${asset.name}"? This soft-deletes the register entry.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(itemUrl(side, asset.id, vesselId, dryDockProjectId), {
        method: "DELETE",
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Delete failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(asset: MachineryAssetDto) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      if (vesselId) body.set("vesselId", vesselId);
      if (dryDockProjectId) body.set("dryDockProjectId", dryDockProjectId);
      body.set("isActive", asset.isActive ? "false" : "true");
      const res = await fetch(itemUrl(side, asset.id, vesselId, dryDockProjectId), {
        method: "PATCH",
        body,
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Status update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await fetch(templateUrl(side, vesselId, dryDockProjectId), {
        cache: "no-store",
        credentials: "same-origin",
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        let message = "Template download failed";
        if (type.includes("application/json")) {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        }
        notify.error(message);
        return;
      }
      const blob = await res.blob();
      const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
      const filename = match?.[1] ?? "machinery-register-template.xlsx";
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

  async function onUploadExcel(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (vesselId) fd.set("vesselId", vesselId);
    if (dryDockProjectId) fd.set("dryDockProjectId", dryDockProjectId);
    try {
      const res = await fetch(parseImportUrl(side), {
        method: "POST",
        body: fd,
        cache: "no-store",
      });
      const data = await readResponseJson<{
        error?: string;
        message?: string;
        rows?: MachineryRegisterImportRow[];
      }>(res);
      if (!res.ok) {
        notify.error(data?.error ?? "Excel parse failed");
        return;
      }
      const rows = (data?.rows ?? []).map((row) => ({
        ...row,
        localId: newLocalId(),
        skip: false,
      }));
      setReviewRows(rows);
      setShowForm(false);
      notify.success(data?.message ?? `Parsed ${rows.length} row(s)`);
    } catch {
      notify.error("Excel parse failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateReviewRow(localId: string, patch: Partial<ReviewRow>) {
    setReviewRows((prev) =>
      prev ? prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)) : prev,
    );
  }

  function removeReviewRow(localId: string) {
    setReviewRows((prev) => (prev ? prev.filter((r) => r.localId !== localId) : prev));
  }

  function cancelReview() {
    setReviewRows(null);
  }

  async function confirmBatch() {
    if (!reviewRows || reviewBlocking || confirmableCount === 0) return;
    setConfirming(true);
    setError(null);
    const rows = reviewValidated
      .filter(({ row, errors }) => !row.skip && errors.length === 0)
      .map(({ row }) => ({
        name: row.name.trim(),
        department: row.department.trim() || "Machinery",
        maker: row.maker.trim(),
        model: row.model.trim(),
        serialNumber: row.serialNumber.trim(),
        units: row.units.trim(),
        location: row.location.trim(),
        notes: row.notes.trim(),
        isActive: row.isActive,
      }));

    try {
      const res = await fetch(batchUrl(side), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: vesselId ?? undefined,
          dryDockProjectId: dryDockProjectId ?? undefined,
          rows,
        }),
      });
      const data = await readResponseJson<{
        error?: string;
        message?: string;
        created?: MachineryAssetDto[];
        failed?: Array<{ index: number; error: string }>;
      }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Batch registration failed");
        notify.error(data?.error ?? "Batch registration failed");
        return;
      }
      const failed = data?.failed ?? [];
      if (failed.length > 0) {
        notify.warning(
          data?.message ??
            `Registered ${data?.created?.length ?? 0}; ${failed.length} row(s) failed.`,
        );
      } else {
        notify.success(data?.message ?? `Registered ${rows.length} machinery asset(s).`);
      }
      setReviewRows(null);
      await load();
    } catch {
      notify.error("Batch registration failed");
    } finally {
      setConfirming(false);
    }
  }

  if (!scoped) {
    return (
      <p className="text-sm text-muted-foreground">
        {side === "ship"
          ? "Select a vessel to manage the machinery register."
          : "Open this page from a dry dock project to manage the vessel machinery register."}
      </p>
    );
  }

  if (loading) {
    return <ActiniumLoadingState label="Loading machinery register…" size="sm" />;
  }

  const editingAsset = editingId ? assets.find((a) => a.id === editingId) : null;
  const previewSrc = photoPreview ?? (!clearPhoto ? existingPhotoUrl : null);
  const importBusy = downloading || uploading || confirming || busy;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Seeded defaults appear automatically for vessels with no assets. Identification numbers are
          assigned per vessel (e.g. CODE-MCH-0001).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={importBusy || reviewRows != null}
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
              if (file) void onUploadExcel(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={importBusy}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Parsing…" : "Upload Excel"}
          </Button>
          {!showForm && reviewRows == null ? (
            <Button type="button" onClick={openCreate} disabled={importBusy}>
              Register machinery
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Excel bulk import supports nameplate fields only — photos cannot be imported from the
        spreadsheet. After registration, use Edit to attach nameplate photos.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {reviewRows != null ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Review Excel import</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit cells, skip duplicates, or remove rows before confirming. Identification numbers
              are auto-generated on confirm. Nameplate photos are not included in Excel import.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewValidated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows left to review.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[10rem]">Name *</TableHead>
                    <TableHead className="min-w-[7rem]">Make</TableHead>
                    <TableHead className="min-w-[7rem]">Model</TableHead>
                    <TableHead className="min-w-[7rem]">Serial</TableHead>
                    <TableHead className="min-w-[5rem]">Units</TableHead>
                    <TableHead className="min-w-[7rem]">Location</TableHead>
                    <TableHead className="min-w-[8rem]">Department</TableHead>
                    <TableHead className="min-w-[8rem]">Notes</TableHead>
                    <TableHead className="min-w-[6rem]">Status</TableHead>
                    <TableHead className="min-w-[12rem]">Issues</TableHead>
                    <TableHead className="min-w-[7rem] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewValidated.map(({ row, errors, warnings }, index) => (
                    <TableRow
                      key={row.localId}
                      className={row.skip ? "opacity-50" : errors.length ? "bg-destructive/5" : undefined}
                    >
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {row.sourceRow || index + 1}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.name}
                          disabled={row.skip}
                          onChange={(e) => updateReviewRow(row.localId, { name: e.target.value })}
                          className="h-8 min-w-[9rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.maker}
                          disabled={row.skip}
                          onChange={(e) => updateReviewRow(row.localId, { maker: e.target.value })}
                          className="h-8 min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.model}
                          disabled={row.skip}
                          onChange={(e) => updateReviewRow(row.localId, { model: e.target.value })}
                          className="h-8 min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.serialNumber}
                          disabled={row.skip}
                          onChange={(e) =>
                            updateReviewRow(row.localId, { serialNumber: e.target.value })
                          }
                          className="h-8 min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.units}
                          disabled={row.skip}
                          onChange={(e) => updateReviewRow(row.localId, { units: e.target.value })}
                          className="h-8 min-w-[4rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.location}
                          disabled={row.skip}
                          onChange={(e) =>
                            updateReviewRow(row.localId, { location: e.target.value })
                          }
                          className="h-8 min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <LabeledSelect
                          items={
                            DEPARTMENTS.some((d) => d.value === row.department)
                              ? DEPARTMENTS
                              : [
                                  ...DEPARTMENTS,
                                  {
                                    value: row.department || "Other",
                                    label: row.department || "Other",
                                  },
                                ]
                          }
                          value={row.department || "Machinery"}
                          onValueChange={(v) => updateReviewRow(row.localId, { department: v })}
                          disabled={row.skip}
                          className="w-full min-w-[7rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Input
                          value={row.notes}
                          disabled={row.skip}
                          onChange={(e) => updateReviewRow(row.localId, { notes: e.target.value })}
                          className="h-8 min-w-[7rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <LabeledSelect
                          items={[
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Deactive" },
                          ]}
                          value={row.isActive ? "active" : "inactive"}
                          onValueChange={(v) =>
                            updateReviewRow(row.localId, { isActive: v === "active" })
                          }
                          disabled={row.skip}
                          className="w-full min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-xs">
                        {errors.map((msg) => (
                          <div key={msg} className="text-destructive">
                            {msg}
                          </div>
                        ))}
                        {warnings.map((msg) => (
                          <div key={msg} className="text-amber-700 dark:text-amber-400">
                            {msg}
                          </div>
                        ))}
                        {!errors.length && !warnings.length ? (
                          <span className="text-muted-foreground">OK</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-right">
                        <div className="flex flex-nowrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={confirming}
                            onClick={() => updateReviewRow(row.localId, { skip: !row.skip })}
                          >
                            {row.skip ? "Include" : "Skip"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={confirming}
                            onClick={() => removeReviewRow(row.localId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={confirming || reviewBlocking || confirmableCount === 0}
                onClick={() => void confirmBatch()}
              >
                {confirming
                  ? "Registering…"
                  : `Confirm registration (${confirmableCount})`}
              </Button>
              <Button type="button" variant="outline" disabled={confirming} onClick={cancelReview}>
                Cancel import
              </Button>
              {reviewBlocking ? (
                <span className="text-sm text-destructive">
                  Fix required field errors or skip/remove those rows.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {editingId ? "Edit machinery" : "Register machinery"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(ev) => void handleSubmit(ev)}>
              <div className="space-y-2">
                <Label htmlFor="mch-name">Machinery name *</Label>
                <Input
                  id="mch-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-id">Identification number</Label>
                <Input
                  id="mch-id"
                  value={editingAsset?.identificationNumber ?? "(auto-generated on save)"}
                  readOnly
                  className="bg-muted font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Department / category</Label>
                <LabeledSelect
                  items={DEPARTMENTS}
                  value={form.department}
                  onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-make">Make</Label>
                <Input
                  id="mch-make"
                  value={form.maker}
                  onChange={(e) => setForm((f) => ({ ...f, maker: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-model">Model</Label>
                <Input
                  id="mch-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-serial">Serial number</Label>
                <Input
                  id="mch-serial"
                  value={form.serialNumber}
                  onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-units">Units</Label>
                <Input
                  id="mch-units"
                  placeholder="e.g. 1 set, 2 units, m³"
                  value={form.units}
                  onChange={(e) => setForm((f) => ({ ...f, units: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-location">Location</Label>
                <Input
                  id="mch-location"
                  placeholder="e.g. Engine room"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mch-notes">Notes</Label>
                <Input
                  id="mch-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mch-photo">Nameplate photo</Label>
                <Input
                  id="mch-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    if (file) setClearPhoto(false);
                  }}
                />
                {previewSrc ? (
                  <div className="mt-2 flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt="Nameplate preview"
                      className="h-24 w-auto rounded border object-contain"
                    />
                    {existingPhotoUrl && !photoFile ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setClearPhoto(true);
                          setExistingPhotoUrl(null);
                        }}
                      >
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect
                  items={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Deactive" },
                  ]}
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(v) => setForm((f) => ({ ...f, isActive: v === "active" }))}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2 md:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : editingId ? "Save changes" : "Register"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sticky right-0 z-10 min-w-[15rem] bg-background text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No machinery registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((a) => (
                  <TableRow key={a.id} className={a.isActive ? undefined : "opacity-60"}>
                    <TableCell className="font-mono text-xs">
                      {a.identificationNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.department}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[a.maker, a.model].filter(Boolean).join(" / ") || "—"}
                      {a.serialNumber ? (
                        <div className="text-xs text-muted-foreground">S/N {a.serialNumber}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{a.units ?? "—"}</TableCell>
                    <TableCell>{a.location ?? "—"}</TableCell>
                    <TableCell>
                      {a.nameplatePhotoUrl ? (
                        <a
                          href={a.nameplatePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{a.isActive ? "Active" : "Deactive"}</TableCell>
                    <TableCell className="sticky right-0 z-10 min-w-[15rem] whitespace-normal bg-background text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                      <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={importBusy}
                          onClick={() => openEdit(a)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={importBusy}
                          onClick={() => void handleToggleActive(a)}
                        >
                          {a.isActive ? "Deactive" : "Active"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={importBusy}
                          onClick={() => void handleDelete(a)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
