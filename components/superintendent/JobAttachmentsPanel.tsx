"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  detectImageMimeFromBytes,
  isProbablyImageFile,
  normalizeImageFile,
} from "@/lib/superintendent/inputImagePreview";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  caption: string | null;
  createdAt: string;
};

type StagedItem = {
  id: string;
  file: File;
  /** Object URL or JPEG data URL for image previews; null for documents. */
  previewUrl: string | null;
  previewSource: "object" | "data" | null;
  kindLabel: string;
};

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,.xlsx,.xls,.csv,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isImageAttachment(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i.test(name);
}

function fileKindLabel(mimeType: string | null, name: string): string {
  if (isImageAttachment(mimeType, name)) return "Image";
  if (mimeType?.includes("pdf") || /\.pdf$/i.test(name)) return "PDF";
  if (
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel") ||
    /\.xlsx?$/i.test(name) ||
    /\.csv$/i.test(name)
  ) {
    return "Excel";
  }
  return "File";
}

function revokeIfObjectUrl(item: Pick<StagedItem, "previewUrl" | "previewSource">) {
  if (item.previewSource === "object" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

async function buildStagedPreview(file: File): Promise<Pick<StagedItem, "previewUrl" | "previewSource" | "kindLabel">> {
  const kindLabel = fileKindLabel(file.type || null, file.name);
  if (!isProbablyImageFile(file)) {
    return { previewUrl: null, previewSource: null, kindLabel };
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
      return { previewUrl: normalized.dataUrl, previewSource: "data", kindLabel: "Image" };
    }

    const mime = detected ?? (file.type.startsWith("image/") ? file.type : "image/jpeg");
    const blob = new Blob([buffer], { type: mime });
    return { previewUrl: URL.createObjectURL(blob), previewSource: "object", kindLabel: "Image" };
  } catch {
    try {
      const normalized = await normalizeImageFile(file);
      return { previewUrl: normalized.dataUrl, previewSource: "data", kindLabel: "Image" };
    } catch {
      return { previewUrl: null, previewSource: null, kindLabel };
    }
  }
}

function DocumentBadge({ label }: { label: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border bg-muted/40 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  );
}

function Thumb({
  src,
  alt,
  fallbackLabel,
}: {
  src: string | null;
  alt: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <DocumentBadge label={fallbackLabel} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 shrink-0 rounded border object-cover bg-muted/30"
      onError={() => setFailed(true)}
    />
  );
}

export function JobAttachmentsPanel({ jobId }: { jobId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const load = useCallback(async () => {
    const res = await fetch(`/api/superintendent/jobs/${jobId}/attachments`);
    if (res.ok) {
      const d = (await res.json()) as { attachments: Attachment[] };
      setAttachments(d.attachments ?? []);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      for (const item of stagedRef.current) revokeIfObjectUrl(item);
    };
  }, []);

  async function stageFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStaging(true);
    try {
      const next: StagedItem[] = [];
      for (const file of Array.from(fileList)) {
        const preview = await buildStagedPreview(file);
        next.push({
          id: newId(),
          file,
          ...preview,
        });
      }
      setStaged((prev) => [...prev, ...next]);
    } finally {
      setStaging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) revokeIfObjectUrl(target);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function uploadStaged() {
    if (staged.length === 0) return;
    setUploading(true);
    const batch = [...staged];
    try {
      for (const item of batch) {
        const fd = new FormData();
        fd.set("file", item.file);
        if (caption.trim()) fd.set("caption", caption.trim());
        await fetch(`/api/superintendent/jobs/${jobId}/attachments`, {
          method: "POST",
          body: fd,
        });
      }
      for (const item of batch) revokeIfObjectUrl(item);
      setStaged([]);
      setCaption("");
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/superintendent/jobs/${jobId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    await load();
  }

  const busy = uploading || staging;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Attach photos, PDFs, and Excel sheets. You can upload multiple files at once.
      </p>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {attachments.map((a) => {
            const kind = fileKindLabel(a.mimeType, a.fileName);
            const showImage = isImageAttachment(a.mimeType, a.fileName) && Boolean(a.fileUrl);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-md border bg-muted/10 px-3 py-2"
              >
                <Thumb
                  src={showImage ? a.fileUrl : null}
                  alt={a.fileName}
                  fallbackLabel={kind === "Image" ? "Image" : kind}
                />
                <div className="min-w-0 flex-1">
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {kind}
                    {a.caption ? ` · ${a.caption}` : null}
                  </p>
                </div>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(a.id)}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {staged.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Ready to upload ({staged.length})
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {staged.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-dashed bg-muted/10 px-3 py-2"
              >
                <Thumb
                  src={s.previewUrl}
                  alt={s.file.name}
                  fallbackLabel={s.kindLabel === "Image" ? "Image" : s.kindLabel}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.file.name}</p>
                  <p className="text-xs text-muted-foreground">{s.kindLabel} · pending</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => removeStaged(s.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => void stageFiles(e.target.files)}
        />
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor={`job-caption-${jobId}`}>Caption (optional, applies to batch)</Label>
          <Input
            id={`job-caption-${jobId}`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Shell renewal sketches"
            disabled={busy}
          />
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {staging ? "Preparing…" : "Add files"}
        </Button>
        <Button type="button" disabled={busy || staged.length === 0} onClick={() => void uploadStaged()}>
          {uploading
            ? "Uploading…"
            : staged.length > 0
              ? `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}`
              : "Upload"}
        </Button>
      </div>
    </div>
  );
}
