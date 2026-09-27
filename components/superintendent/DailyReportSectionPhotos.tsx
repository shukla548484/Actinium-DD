"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilePlus2, FileText, ImagePlus, Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  detectImageMimeFromBytes,
  isProbablyImageFile,
  normalizeImageFile,
} from "@/lib/superintendent/inputImagePreview";
import {
  DAILY_REPORT_MAX_DOCUMENTS_PER_POINT,
  DAILY_REPORT_MAX_IMAGES_PER_POINT,
} from "@/lib/superintendent/dailyReportSections";
import { cn } from "@/lib/utils";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  caption: string | null;
  pointId: string | null;
  createdAt: string;
};

/** Local pending attachment before the report exists (or before upload). */
export type PendingPointPhoto = {
  id: string;
  file: File;
  previewUrl: string | null;
  previewSource: "object" | "data" | null;
  caption: string;
  kind: "photo" | "document";
};

export type PendingPointPhotoUpload = {
  sectionKey: string;
  pointId: string;
  file: File;
  caption: string;
};

const PHOTO_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,image/*";
const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function revokePendingPhotoPreview(
  item: Pick<PendingPointPhoto, "previewUrl" | "previewSource">,
) {
  if (item.previewSource === "object" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function isDailyReportImageAttachment(item: Pick<Attachment, "mimeType" | "fileName">): boolean {
  if (item.mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(item.fileName);
}

export function isDailyReportPdfAttachment(item: Pick<Attachment, "mimeType" | "fileName">): boolean {
  return item.mimeType === "application/pdf" || /\.pdf$/i.test(item.fileName);
}

export function dailyReportFileKindLabel(item: Pick<Attachment, "mimeType" | "fileName">): string {
  if (isDailyReportPdfAttachment(item)) return "PDF";
  if (/\.docx?$/i.test(item.fileName)) return "Word";
  if (/\.xlsx?$/i.test(item.fileName)) return "Excel";
  return "File";
}

async function buildStagedPreview(
  file: File,
): Promise<Pick<PendingPointPhoto, "previewUrl" | "previewSource">> {
  if (!isProbablyImageFile(file)) {
    return { previewUrl: null, previewSource: null };
  }
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detected = detectImageMimeFromBytes(bytes);
    const needsNormalize =
      detected === "image/heic" ||
      detected === "image/avif" ||
      /heic|heif|avif/i.test(file.type) ||
      /\.(heic|heif|avif)$/i.test(file.name);

    if (needsNormalize) {
      const normalized = await normalizeImageFile(file);
      return { previewUrl: normalized.dataUrl, previewSource: "data" };
    }

    const mime = detected ?? (file.type.startsWith("image/") ? file.type : "image/jpeg");
    const blob = new Blob([buffer], { type: mime });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Preview could not be created"));
      reader.onerror = () => reject(reader.error ?? new Error("Preview could not be created"));
      reader.readAsDataURL(blob);
    });
    return { previewUrl: dataUrl, previewSource: "data" };
  } catch {
    try {
      const normalized = await normalizeImageFile(file);
      return { previewUrl: normalized.dataUrl, previewSource: "data" };
    } catch {
      return { previewUrl: URL.createObjectURL(file), previewSource: "object" };
    }
  }
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex size-20 items-center justify-center rounded-md border bg-muted/40 text-[10px] text-muted-foreground">
        Img
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-20 rounded-md border object-cover bg-muted/30"
      onError={() => setFailed(true)}
    />
  );
}

/** Upload pending daily report attachments after the daily report has been created. */
export async function uploadPendingDailyReportPhotos(
  reportId: string,
  pending: PendingPointPhotoUpload[],
): Promise<{ uploaded: number; error: string | null }> {
  let uploaded = 0;
  for (const item of pending) {
    const fd = new FormData();
    fd.set("file", item.file);
    fd.set("sectionKey", item.sectionKey);
    fd.set("pointId", item.pointId);
    if (item.caption.trim()) fd.set("caption", item.caption.trim());
    const res = await fetch(`/api/superintendent/daily-reports/${reportId}/attachments`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      return { uploaded, error: d.error ?? "Attachment upload failed" };
    }
    uploaded += 1;
  }
  return { uploaded, error: null };
}

function AttachmentFileCard({
  attachment,
  busy,
  caption,
  saving,
  onCaptionChange,
  onCaptionSave,
  onRemove,
}: {
  attachment: Attachment;
  busy: boolean;
  caption: string;
  saving: boolean;
  onCaptionChange: (value: string) => void;
  onCaptionSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <a
            href={attachment.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs font-medium hover:underline"
            title={attachment.fileName}
          >
            {attachment.fileName}
          </a>
          <p className="text-[10px] text-muted-foreground">
            {dailyReportFileKindLabel(attachment)}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          aria-label="Remove report attachment"
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Input
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        onBlur={onCaptionSave}
        placeholder="Reference label"
        className="mt-2 h-7 px-1.5 text-[11px]"
        disabled={busy || saving}
      />
    </div>
  );
}

/**
 * Attachment strip scoped to one work point.
 * With reportId: upload immediately. Without: stage locally until save.
 */
export function DailyReportPointPhotos({
  reportId,
  sectionKey,
  pointId,
  onCountChange,
  onPendingChange,
}: {
  reportId?: string | null;
  sectionKey: string;
  pointId: string;
  onCountChange?: (count: number) => void;
  /** Fired whenever local pending attachments change (create flow). */
  onPendingChange?: (pending: PendingPointPhoto[]) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [savingCaptionId, setSavingCaptionId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPointPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  const onCountChangeRef = useRef(onCountChange);
  const onPendingChangeRef = useRef(onPendingChange);

  useEffect(() => {
    pendingRef.current = pending;
    onCountChangeRef.current?.(attachments.length + pending.length);
    if (!reportId) onPendingChangeRef.current?.(pending);
  }, [attachments.length, pending, reportId]);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  const notifyPending = useCallback((next: PendingPointPhoto[]) => {
    onPendingChangeRef.current?.(next);
  }, []);

  const load = useCallback(async () => {
    if (!reportId) return;
    const res = await fetch(
      `/api/superintendent/daily-reports/${reportId}/attachments?sectionKey=${encodeURIComponent(sectionKey)}&pointId=${encodeURIComponent(pointId)}`,
    );
    if (res.ok) {
      const d = (await res.json()) as { attachments: Attachment[] };
      const list = (d.attachments ?? []).filter((a) => a.pointId === pointId);
      setAttachments(list);
      setCaptions(Object.fromEntries(list.map((a) => [a.id, a.caption ?? ""])));
    }
  }, [reportId, sectionKey, pointId]);

  useEffect(() => {
    if (!reportId) {
      onCountChangeRef.current?.(pendingRef.current.length);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/superintendent/daily-reports/${reportId}/attachments?sectionKey=${encodeURIComponent(sectionKey)}&pointId=${encodeURIComponent(pointId)}`,
      );
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as { attachments: Attachment[] };
      const list = (d.attachments ?? []).filter((a) => a.pointId === pointId);
      if (cancelled) return;
      setAttachments(list);
      setCaptions(Object.fromEntries(list.map((a) => [a.id, a.caption ?? ""])));
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, sectionKey, pointId]);

  useEffect(() => {
    const missing = pending.filter((item) => item.kind === "photo" && !item.previewUrl);
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (item) => ({ id: item.id, preview: await buildStagedPreview(item.file) })),
    ).then((repaired) => {
      if (cancelled) return;
      const byId = new Map(
        repaired
          .filter((item) => Boolean(item.preview.previewUrl))
          .map((item) => [item.id, item.preview]),
      );
      if (byId.size === 0) return;
      setPending((current) =>
        current.map((item) => {
          const preview = byId.get(item.id);
          return preview ? { ...item, ...preview } : item;
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [pending]);

  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) revokePendingPhotoPreview(item);
    };
  }, []);

  async function uploadFiles(items: PendingPointPhoto[]) {
    if (!reportId || items.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const item of items) {
        const fd = new FormData();
        fd.set("file", item.file);
        fd.set("sectionKey", sectionKey);
        fd.set("pointId", pointId);
        if (item.caption.trim()) fd.set("caption", item.caption.trim());
        const res = await fetch(`/api/superintendent/daily-reports/${reportId}/attachments`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(d.error ?? "Upload failed");
          break;
        }
      }
      for (const item of items) revokePendingPhotoPreview(item);
      setPending([]);
      notifyPending([]);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function addFiles(fileList: FileList | null, kind: PendingPointPhoto["kind"]) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const storedKindCount = attachments.filter((item) =>
      kind === "photo" ? isDailyReportImageAttachment(item) : !isDailyReportImageAttachment(item),
    ).length;
    const pendingKindCount = pending.filter((item) => item.kind === kind).length;
    const limit =
      kind === "photo"
        ? DAILY_REPORT_MAX_IMAGES_PER_POINT
        : DAILY_REPORT_MAX_DOCUMENTS_PER_POINT;
    const remaining = limit - storedKindCount - pendingKindCount;
    if (remaining <= 0) {
      setError(
        kind === "photo"
          ? `Maximum ${limit} photos per point`
          : `Maximum ${limit} report/reference files per point`,
      );
      return;
    }
    setStaging(true);
    try {
      const next: PendingPointPhoto[] = [];
      for (const file of Array.from(fileList).slice(0, remaining)) {
        const preview: Pick<PendingPointPhoto, "previewUrl" | "previewSource"> =
          kind === "photo"
            ? await buildStagedPreview(file)
            : { previewUrl: null, previewSource: null };
        next.push({ id: newId(), file, caption: "", kind, ...preview });
      }
      if (reportId) {
        const mergedPreview = [...pending, ...next];
        setPending(mergedPreview);
        await uploadFiles(next);
      } else {
        const merged = [...pending, ...next];
        setPending(merged);
      }
    } finally {
      setStaging(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (documentInputRef.current) documentInputRef.current.value = "";
    }
  }

  function removePending(id: string) {
    const target = pending.find((item) => item.id === id);
    if (target) revokePendingPhotoPreview(target);
    setPending(pending.filter((item) => item.id !== id));
  }

  function updatePendingCaption(id: string, caption: string) {
    setPending((prev) => prev.map((item) => (item.id === id ? { ...item, caption } : item)));
  }

  async function saveCaption(attachmentId: string) {
    if (!reportId) return;
    const caption = (captions[attachmentId] ?? "").trim();
    const current = attachments.find((a) => a.id === attachmentId);
    if (!current || (current.caption ?? "") === caption) return;
    setSavingCaptionId(attachmentId);
    setError(null);
    try {
      const res = await fetch(
        `/api/superintendent/daily-reports/${reportId}/attachments/${attachmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: caption || null }),
        },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to save label");
        return;
      }
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, caption: caption || null } : a)),
      );
    } finally {
      setSavingCaptionId(null);
    }
  }

  async function remove(attachmentId: string) {
    if (!reportId) return;
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/superintendent/daily-reports/${reportId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    await load();
  }

  const busy = uploading || staging;
  const showUploadHint = !reportId && pending.length > 0;
  const photoAttachments = attachments.filter(isDailyReportImageAttachment);
  const documentAttachments = attachments.filter((a) => !isDailyReportImageAttachment(a));
  const pendingPhotos = pending.filter((item) => item.kind === "photo");
  const pendingDocuments = pending.filter((item) => item.kind === "document");
  const atPhotoCap =
    photoAttachments.length + pendingPhotos.length >= DAILY_REPORT_MAX_IMAGES_PER_POINT;
  const atDocumentCap =
    documentAttachments.length + pendingDocuments.length >=
    DAILY_REPORT_MAX_DOCUMENTS_PER_POINT;

  return (
    <div className="grid gap-4 rounded-lg border bg-muted/10 p-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Photo attachments (optional)</span>
          <Info className="size-3.5 opacity-70" aria-hidden />
        </div>

        {showUploadHint ? (
          <p className="text-[11px] text-muted-foreground">
            Attachments will upload when you save the report.
          </p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap items-start gap-2.5">
          {photoAttachments.map((a) => (
            <div key={a.id} className="w-20 space-y-1">
              <div className="relative">
                <Thumb key={a.fileUrl} src={a.fileUrl} alt={a.caption || a.fileName} />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                  disabled={busy}
                  aria-label="Remove photo"
                  onClick={() => void remove(a.id)}
                >
                  <X className="size-3" />
                </button>
              </div>
              <Input
                value={captions[a.id] ?? ""}
                onChange={(e) =>
                  setCaptions((prev) => ({ ...prev, [a.id]: e.target.value }))
                }
                onBlur={() => void saveCaption(a.id)}
                placeholder="Label"
                className="h-7 px-1.5 text-[11px]"
                disabled={busy || savingCaptionId === a.id}
              />
            </div>
          ))}

          {pendingPhotos.map((s) => (
            <div key={s.id} className={cn("w-20 space-y-1", reportId ? "opacity-80" : undefined)}>
              <div className="relative">
                <Thumb
                  key={s.previewUrl ?? s.id}
                  src={s.previewUrl}
                  alt={s.caption || s.file.name}
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                  disabled={busy}
                  aria-label="Remove photo"
                  onClick={() => removePending(s.id)}
                >
                  <X className="size-3" />
                </button>
              </div>
              <Input
                value={s.caption}
                onChange={(e) => updatePendingCaption(s.id, e.target.value)}
                placeholder="Label"
                className="h-7 px-1.5 text-[11px]"
                disabled={busy}
              />
            </div>
          ))}

          <input
            ref={photoInputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="hidden"
            disabled={busy || atPhotoCap}
            onChange={(e) => void addFiles(e.target.files, "photo")}
          />

          <button
            type="button"
            disabled={busy || atPhotoCap}
            onClick={() => photoInputRef.current?.click()}
            className={cn(
              "flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 text-primary transition-colors",
              "hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <ImagePlus className="size-5" />
            <span className="text-[10px] font-medium leading-tight">
              {staging || uploading ? "…" : "+ Add Photo"}
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Report / Reference (optional)</span>
          <Info className="size-3.5 opacity-70" aria-hidden />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Attach PDF, Word or Excel reports. PDF files are shown in the print/PDF view.
        </p>

        <div className="space-y-2">
          {documentAttachments.map((a) => (
            <AttachmentFileCard
              key={a.id}
              attachment={a}
              busy={busy}
              caption={captions[a.id] ?? ""}
              saving={savingCaptionId === a.id}
              onCaptionChange={(value) =>
                setCaptions((prev) => ({ ...prev, [a.id]: value }))
              }
              onCaptionSave={() => void saveCaption(a.id)}
              onRemove={() => void remove(a.id)}
            />
          ))}

          {pendingDocuments.map((s) => (
            <div key={s.id} className="rounded-lg border bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={s.file.name}>
                    {s.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Staged document</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  aria-label="Remove report attachment"
                  onClick={() => removePending(s.id)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <Input
                value={s.caption}
                onChange={(e) => updatePendingCaption(s.id, e.target.value)}
                placeholder="Reference label"
                className="mt-2 h-7 px-1.5 text-[11px]"
                disabled={busy}
              />
            </div>
          ))}

          <input
            ref={documentInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            multiple
            className="hidden"
            disabled={busy || atDocumentCap}
            onChange={(e) => void addFiles(e.target.files, "document")}
          />

          <button
            type="button"
            disabled={busy || atDocumentCap}
            onClick={() => documentInputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors",
              "hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <FilePlus2 className="size-4" />
            {staging || uploading ? "Adding…" : "+ Attach Report / Reference"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer DailyReportPointPhotos — kept for any remaining imports. */
export function DailyReportSectionPhotos({
  reportId,
  sectionKey,
}: {
  reportId: string;
  sectionKey: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Attachments are managed per work point below
      <span className="sr-only">
        {reportId} {sectionKey}
      </span>
    </p>
  );
}
