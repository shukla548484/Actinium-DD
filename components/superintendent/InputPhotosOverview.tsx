"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
const MAX_BYTES = 4 * 1024 * 1024;

function isPhotoItem(value: unknown): value is InputPhotoItem {
  if (!value || typeof value !== "object") return false;
  const v = value as InputPhotoItem;
  return Boolean(v.id && v.name && v.dataUrl);
}

export function parseInputPhotos(value: unknown): InputPhotoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPhotoItem);
}

function newPhotoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function InputPhotosOverview({ photos, onChange, disabled, label = "Photos" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  function addFiles(fileList: FileList | null) {
    if (!fileList || disabled) return;
    const remaining = MAX_PHOTOS - photosRef.current.length;
    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_BYTES)
      .slice(0, remaining);
    if (files.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const staged: InputPhotoItem[] = files.map((file) => ({
      id: newPhotoId(),
      name: file.name,
      mimeType: file.type || "image/jpeg",
      dataUrl: URL.createObjectURL(file),
    }));
    onChange([...photosRef.current, ...staged]);

    files.forEach((file, index) => {
      const id = staged[index]?.id;
      const blobUrl = staged[index]?.dataUrl;
      if (!id) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : blobUrl;
        onChange(photosRef.current.map((p) => (p.id === id ? { ...p, dataUrl: dataUrl ?? p.dataUrl } : p)));
        if (blobUrl?.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      };
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || photos.length >= MAX_PHOTOS}
            onClick={() => inputRef.current?.click()}
          >
            Add photos
          </Button>
        </div>
      </div>
      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No photos yet. Images appear here as soon as you add them.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="group relative overflow-hidden rounded-md border bg-muted/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt={photo.name}
                className="aspect-square h-full w-full object-cover"
              />
              <figcaption className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                {photo.name}
              </figcaption>
              {disabled ? null : (
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
                >
                  Remove
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
