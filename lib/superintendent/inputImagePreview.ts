/** Client-side image helpers for input photo previews and persistence. */

export type NormalizedImage = {
  dataUrl: string;
  mimeType: string;
  name: string;
};

function bytesStartWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

/** Detect real image type from magic bytes (macOS screenshots are often HEIF named .jpg). */
export function detectImageMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // ISO BMFF: ....ftyp.... (HEIC / HEIF / AVIF)
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (brand === "ftyp") {
      const major = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
      if (major.startsWith("avif") || major.startsWith("avis")) return "image/avif";
      if (
        major.startsWith("heic") ||
        major.startsWith("heix") ||
        major.startsWith("heif") ||
        major.startsWith("mif1") ||
        major.startsWith("msf1")
      ) {
        return "image/heic";
      }
    }
  }
  return null;
}

export function isProbablyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i.test(file.name);
}

function peekDataUrlBytes(dataUrl: string, maxBytes = 64): Uint8Array | null {
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1, comma + 1 + Math.ceil((maxBytes * 4) / 3) + 8);
  try {
    if (/;base64/i.test(header)) {
      const binary = atob(payload);
      const n = Math.min(maxBytes, binary.length);
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    const decoded = decodeURIComponent(payload);
    const n = Math.min(maxBytes, decoded.length);
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) bytes[i] = decoded.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** True when a stored data URL is likely HEIF/AVIF mislabeled as JPEG (broken <img>). */
export function storedImageDataUrlNeedsRepair(dataUrl: string, mimeType?: string): boolean {
  if (/heic|heif|avif/i.test(mimeType ?? "")) return true;
  const bytes = peekDataUrlBytes(dataUrl);
  if (!bytes) return false;
  const detected = detectImageMimeFromBytes(bytes);
  if (!detected) return false;
  if (detected === "image/heic" || detected === "image/avif") return true;
  const declared = /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? "";
  return Boolean(declared && declared !== detected);
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Browser could not decode this image"));
    img.src = src;
  });
}

function canvasToJpegDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge = 1920,
  quality = 0.85,
): string {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

async function decodeBlobToJpegDataUrl(blob: Blob): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const dataUrl = canvasToJpegDataUrl(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      return dataUrl;
    } catch {
      /* fall through */
    }
  }

  const ImageDecoderCtor = (globalThis as unknown as {
    ImageDecoder?: new (init: { data: BufferSource; type: string }) => {
      decode: (opts?: {
        frameIndex?: number;
      }) => Promise<{
        image: CanvasImageSource & {
          codedWidth: number;
          codedHeight: number;
          close?: () => void;
        };
      }>;
      close?: () => void;
    };
  }).ImageDecoder;

  if (ImageDecoderCtor && blob.type) {
    try {
      const buffer = await blob.arrayBuffer();
      const decoder = new ImageDecoderCtor({ data: buffer, type: blob.type });
      const { image } = await decoder.decode({ frameIndex: 0 });
      const dataUrl = canvasToJpegDataUrl(
        image,
        image.codedWidth || 1,
        image.codedHeight || 1,
      );
      image.close?.();
      decoder.close?.();
      return dataUrl;
    } catch {
      /* fall through */
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(objectUrl);
    return canvasToJpegDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Build a browser-displayable JPEG data URL.
 * Fixes HEIC/HEIF files that are often uploaded as `.jpg` with a wrong MIME type.
 */
export async function normalizeImageFile(file: File): Promise<NormalizedImage> {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const detected =
    detectImageMimeFromBytes(bytes) ?? (file.type.startsWith("image/") ? file.type : "image/jpeg");
  const blob = new Blob([buffer], { type: detected });
  const dataUrl = await decodeBlobToJpegDataUrl(blob);
  return {
    dataUrl,
    mimeType: "image/jpeg",
    name: file.name.replace(/\.(heic|heif|avif)$/i, ".jpg"),
  };
}

/**
 * Repair a stored data URL that was saved with the wrong MIME (e.g. HEIF bytes as image/jpeg).
 * Returns a JPEG data URL when the browser can decode it; otherwise null.
 */
export async function repairStoredImageDataUrl(dataUrl: string): Promise<string | null> {
  if (!dataUrl?.startsWith("data:")) return null;
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const isBase64 = /;base64/i.test(header);
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const detected = detectImageMimeFromBytes(bytes);
    if (!detected) {
      const img = await loadImageElement(dataUrl);
      return canvasToJpegDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    }

    const blob = new Blob([bytes], { type: detected });
    return await decodeBlobToJpegDataUrl(blob);
  } catch {
    return null;
  }
}
