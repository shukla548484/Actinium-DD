"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { InputPhotoItem } from "@/components/superintendent/InputPhotosOverview";
import {
  isProbablyImageFile,
  normalizeImageFile,
  repairStoredImageDataUrl,
  storedImageDataUrlNeedsRepair,
} from "@/lib/superintendent/inputImagePreview";

type Props = {
  files: InputPhotoItem[];
  onChange: (files: InputPhotoItem[]) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  accept?: string;
};

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;

function newFileId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isImage(mimeType: string, name: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i.test(name);
}

function FileThumb({
  file,
  disabled,
  onRemove,
  onRepaired,
}: {
  file: InputPhotoItem;
  disabled?: boolean;
  onRemove: () => void;
  onRepaired: (dataUrl: string, mimeType: string) => void;
}) {
  const [src, setSrc] = useState(file.dataUrl);
  const [failed, setFailed] = useState(false);
  const triedRepair = useRef(false);

  async function tryRepair() {
    if (triedRepair.current) return;
    triedRepair.current = true;
    const repaired = await repairStoredImageDataUrl(file.dataUrl);
    if (repaired) {
      setSrc(repaired);
      setFailed(false);
      onRepaired(repaired, "image/jpeg");
      return;
    }
    setFailed(true);
  }

  useEffect(() => {
    setSrc(file.dataUrl);
    setFailed(false);
    triedRepair.current = false;
    if (
      isImage(file.mimeType, file.name) &&
      (storedImageDataUrlNeedsRepair(file.dataUrl, file.mimeType) || /\.heic$/i.test(file.name))
    ) {
      void tryRepair();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, file.dataUrl]);

  return (
    <li className="overflow-hidden rounded-md border">
      {isImage(file.mimeType, file.name) ? (
        failed ? (
          <div className="flex h-28 items-center justify-center bg-muted/40 px-3 text-center text-xs text-muted-foreground">
            Preview unavailable
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={file.name}
            className="h-28 w-full object-cover"
            onError={() => {
              void tryRepair();
            }}
          />
        )
      ) : (
        <div className="flex h-28 items-center justify-center bg-muted/40 px-3 text-center text-xs text-muted-foreground">
          {file.mimeType.includes("pdf") ? "PDF" : "Document"}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs hover:underline"
        >
          {file.name}
        </a>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

export function InputFileAttachments({
  files,
  onChange,
  disabled,
  label,
  hint,
  accept = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.doc,.docx",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const [busy, setBusy] = useState(false);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || disabled || busy) return;
    const remaining = MAX_FILES - filesRef.current.length;
    const nextFiles = Array.from(fileList)
      .filter((f) => f.size <= MAX_BYTES)
      .slice(0, remaining);
    if (nextFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const staged: InputPhotoItem[] = [];
      for (const file of nextFiles) {
        if (isProbablyImageFile(file)) {
          try {
            const normalized = await normalizeImageFile(file);
            staged.push({
              id: newFileId(),
              name: normalized.name,
              mimeType: normalized.mimeType,
              dataUrl: normalized.dataUrl,
            });
            continue;
          } catch {
            /* fall through to raw data URL for non-decodable images */
          }
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error ?? new Error("read failed"));
          reader.readAsDataURL(file);
        });
        staged.push({
          id: newFileId(),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
        });
      }
      if (staged.length > 0) onChange([...filesRef.current, ...staged]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>{label}</Label>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => void addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy || files.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Processing…" : "Attach file"}
          </Button>
        </div>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No file attached yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <FileThumb
              key={file.id}
              file={file}
              disabled={disabled}
              onRemove={() => onChange(files.filter((f) => f.id !== file.id))}
              onRepaired={(dataUrl, mimeType) => {
                onChange(
                  filesRef.current.map((f) =>
                    f.id === file.id ? { ...f, dataUrl, mimeType } : f,
                  ),
                );
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
