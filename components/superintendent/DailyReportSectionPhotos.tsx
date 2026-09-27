"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  detectImageMimeFromBytes,
  isProbablyImageFile,
  normalizeImageFile,
} from "@/lib/superintendent/inputImagePreview";
import { DAILY_REPORT_MAX_IMAGES_PER_SECTION } from "@/lib/superintendent/dailyReportSections";

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
  previewUrl: string | null;
  previewSource: "object" | "data" | null;
};

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,image/*";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function revokeIfObjectUrl(item: Pick<StagedItem, "previewUrl" | "previewSource">) {
  if (item.previewSource === "object" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

async function buildStagedPreview(file: File): Promise<Pick<StagedItem, "previewUrl" | "previewSource">> {
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
    return { previewUrl: URL.createObjectURL(blob), previewSource: "object" };
  } catch {
    try {
      const normalized = await normalizeImageFile(file);
      return { previewUrl: normalized.dataUrl, previewSource: "data" };
    } catch {
      return { previewUrl: null, previewSource: null };
    }
  }
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-muted/40 text-[10px] text-muted-foreground">
        Img
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 shrink-0 rounded border object-cover bg-muted/30"
      onError={() => setFailed(true)}
    />
  );
}

export function DailyReportSectionPhotos({
  reportId,
  sectionKey,
}: {
  reportId: string;
  sectionKey: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/superintendent/daily-reports/${reportId}/attachments?sectionKey=${encodeURIComponent(sectionKey)}`,
    );
    if (res.ok) {
      const d = (await res.json()) as { attachments: Attachment[] };
      setAttachments(d.attachments ?? []);
    }
  }, [reportId, sectionKey]);

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
    setError(null);
    const remaining = DAILY_REPORT_MAX_IMAGES_PER_SECTION - attachments.length - staged.length;
    if (remaining <= 0) {
      setError(`Maximum ${DAILY_REPORT_MAX_IMAGES_PER_SECTION} images per section`);
      return;
    }
    setStaging(true);
    try {
      const next: StagedItem[] = [];
      for (const file of Array.from(fileList).slice(0, remaining)) {
        const preview = await buildStagedPreview(file);
        next.push({ id: newId(), file, ...preview });
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
    setError(null);
    const batch = [...staged];
    try {
      for (const item of batch) {
        const fd = new FormData();
        fd.set("file", item.file);
        fd.set("sectionKey", sectionKey);
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
      for (const item of batch) revokeIfObjectUrl(item);
      setStaged([]);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachmentId: string) {
    if (!confirm("Remove this photo?")) return;
    await fetch(`/api/superintendent/daily-reports/${reportId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    await load();
  }

  const busy = uploading || staging;
  const atCap = attachments.length + staged.length >= DAILY_REPORT_MAX_IMAGES_PER_SECTION;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Photos ({attachments.length}/{DAILY_REPORT_MAX_IMAGES_PER_SECTION})
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded border bg-muted/10 px-2 py-1">
              <Thumb src={a.fileUrl} alt={a.fileName} />
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="max-w-[8rem] truncate text-xs text-primary hover:underline"
              >
                {a.fileName}
              </a>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove(a.id)}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {staged.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {staged.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded border border-dashed bg-muted/10 px-2 py-1"
            >
              <Thumb src={s.previewUrl} alt={s.file.name} />
              <span className="max-w-[8rem] truncate text-xs">{s.file.name}</span>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => removeStaged(s.id)}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={busy || atCap}
          onChange={(e) => void stageFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || atCap}
          onClick={() => fileInputRef.current?.click()}
        >
          {staging ? "Preparing…" : "Add photos"}
        </Button>
        {staged.length > 0 ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void uploadStaged()}>
            {uploading ? "Uploading…" : `Upload ${staged.length}`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
