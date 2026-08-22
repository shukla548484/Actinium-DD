"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { InputPhotoItem } from "@/components/superintendent/InputPhotosOverview";

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
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

export function InputFileAttachments({
  files,
  onChange,
  disabled,
  label,
  hint,
  accept = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  function addFiles(fileList: FileList | null) {
    if (!fileList || disabled) return;
    const remaining = MAX_FILES - filesRef.current.length;
    const nextFiles = Array.from(fileList)
      .filter((f) => f.size <= MAX_BYTES)
      .slice(0, remaining);
    if (nextFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const staged: InputPhotoItem[] = nextFiles.map((file) => ({
      id: newFileId(),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl: URL.createObjectURL(file),
    }));
    onChange([...filesRef.current, ...staged]);

    nextFiles.forEach((file, index) => {
      const id = staged[index]?.id;
      const blobUrl = staged[index]?.dataUrl;
      if (!id) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : blobUrl;
        onChange(
          filesRef.current.map((p) => (p.id === id ? { ...p, dataUrl: dataUrl ?? p.dataUrl } : p)),
        );
        if (blobUrl?.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      };
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = "";
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
            disabled={disabled}
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || files.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
          >
            Attach file
          </Button>
        </div>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No file attached yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <li key={file.id} className="overflow-hidden rounded-md border">
              {isImage(file.mimeType, file.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.dataUrl} alt={file.name} className="h-28 w-full object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-muted/40 px-3 text-center text-xs text-muted-foreground">
                  {file.mimeType.includes("pdf") ? "PDF" : "Document"}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <a
                  href={file.dataUrl}
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
                    onClick={() => onChange(files.filter((f) => f.id !== file.id))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
