"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  isProbablyImageFile,
  normalizeImageFile,
  repairStoredImageDataUrl,
  storedImageDataUrlNeedsRepair,
} from "@/lib/superintendent/inputImagePreview";

export type InputPhotoItem = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

type Props = {
  photos: InputPhotoItem[];
  onChange: (photos: InputPhotoItem[]) => void;
  disabled?: boolean;
  label?: string;
};

const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;

function isPhotoItem(value: unknown): value is InputPhotoItem {
  if (!value || typeof value !== "object") return false;
  const v = value as InputPhotoItem;
  return Boolean(v.id && v.name && typeof v.dataUrl === "string" && v.dataUrl.length > 0);
}

export function parseInputPhotos(value: unknown): InputPhotoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPhotoItem);
}

function newPhotoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function PhotoThumb({
  photo,
  disabled,
  onRemove,
  onRepaired,
}: {
  photo: InputPhotoItem;
  disabled?: boolean;
  onRemove: () => void;
  onRepaired: (dataUrl: string, mimeType: string) => void;
}) {
  const [src, setSrc] = useState(photo.dataUrl);
  const [failed, setFailed] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const triedRepair = useRef(false);

  useEffect(() => {
    setSrc(photo.dataUrl);
    setFailed(false);
    triedRepair.current = false;

    if (storedImageDataUrlNeedsRepair(photo.dataUrl, photo.mimeType) || /\.heic$/i.test(photo.name)) {
      void tryRepair();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repair once per photo identity
  }, [photo.id, photo.dataUrl]);

  async function tryRepair() {
    if (triedRepair.current || repairing) return;
    triedRepair.current = true;
    setRepairing(true);
    try {
      const repaired = await repairStoredImageDataUrl(photo.dataUrl);
      if (repaired) {
        setSrc(repaired);
        setFailed(false);
        onRepaired(repaired, "image/jpeg");
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setRepairing(false);
    }
  }

  return (
    <figure className="group relative overflow-hidden rounded-md border bg-muted/30">
      {failed ? (
        <div className="flex aspect-square flex-col items-center justify-center gap-1 bg-muted/50 px-2 text-center">
          <span className="text-xs font-medium text-muted-foreground">Preview unavailable</span>
          <span className="line-clamp-2 text-[10px] text-muted-foreground">{photo.name}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={photo.name}
          className="aspect-square h-full w-full object-cover"
          onError={() => {
            void (async () => {
              if (!triedRepair.current) {
                await tryRepair();
                return;
              }
              setFailed(true);
            })();
          }}
          onLoad={() => setFailed(false)}
        />
      )}
      {repairing ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-[10px] text-muted-foreground">
          Fixing preview…
        </div>
      ) : null}
      <figcaption className="truncate px-1.5 py-1 text-[10px] text-muted-foreground" title={photo.name}>
        {photo.name}
      </figcaption>
      {disabled ? null : (
        <button
          type="button"
          className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </figure>
  );
}

export function InputPhotosOverview({ photos, onChange, disabled, label = "Photos" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || disabled || busy) return;
    setError(null);
    const remaining = MAX_PHOTOS - photosRef.current.length;
    const files = Array.from(fileList)
      .filter((f) => isProbablyImageFile(f) && f.size <= MAX_BYTES)
      .slice(0, remaining);

    if (files.length === 0) {
      setError("Select image files under 8 MB (JPG, PNG, WebP, HEIC).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const next: InputPhotoItem[] = [];
      const failures: string[] = [];
      for (const file of files) {
        try {
          const normalized = await normalizeImageFile(file);
          next.push({
            id: newPhotoId(),
            name: normalized.name,
            mimeType: normalized.mimeType,
            dataUrl: normalized.dataUrl,
          });
        } catch {
          failures.push(file.name);
        }
      }
      if (next.length > 0) {
        onChange([...photosRef.current, ...next]);
      }
      if (failures.length > 0) {
        setError(
          `Could not preview: ${failures.join(", ")}. Convert HEIC/HEIF to JPG on the device and try again.`,
        );
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">
            Thumbnails show immediately. HEIC/Mac screenshots are converted to JPG for preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => void addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy || photos.length >= MAX_PHOTOS}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Processing…" : "Add photos"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No photos yet. Images appear here as soon as you add them.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              disabled={disabled}
              onRemove={() => onChange(photos.filter((p) => p.id !== photo.id))}
              onRepaired={(dataUrl, mimeType) => {
                onChange(
                  photosRef.current.map((p) =>
                    p.id === photo.id ? { ...p, dataUrl, mimeType } : p,
                  ),
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
