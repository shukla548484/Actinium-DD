import { isGcsUrl } from "@/lib/local-file-resolver";

export function extractPurchaseAttachmentUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("http") || trimmed.startsWith("local://")) return [trimmed];
    try {
      return extractPurchaseAttachmentUrls(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    const urls: string[] = [];
    for (const entry of raw) {
      if (typeof entry === "string" && entry.length > 0) urls.push(entry);
      else if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const url =
          (typeof obj.url === "string" && obj.url) ||
          (typeof obj.fileUrl === "string" && obj.fileUrl);
        if (url) urls.push(url);
      }
    }
    return urls;
  }
  return [];
}

export function replacePurchaseAttachmentUrl(
  raw: unknown,
  fromUrl: string,
  toUrl: string
): unknown {
  if (raw == null) return raw;
  if (typeof raw === "string") {
    if (raw.trim() === fromUrl) return toUrl;
    if (raw.trim().startsWith("[") || raw.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const replaced = replacePurchaseAttachmentUrl(parsed, fromUrl, toUrl);
        return typeof replaced === "string" ? replaced : JSON.stringify(replaced);
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === "string") return entry === fromUrl ? toUrl : entry;
      if (entry && typeof entry === "object") {
        const obj = { ...(entry as Record<string, unknown>) };
        if (obj.url === fromUrl) obj.url = toUrl;
        if (obj.fileUrl === fromUrl) obj.fileUrl = toUrl;
        return obj;
      }
      return entry;
    });
  }
  return raw;
}

export function needsPurchaseUrlGcsUpload(url: string | null | undefined): boolean {
  return !!url && url.startsWith("local://");
}

export function classifyPurchaseUrlSource(
  url: string | null | undefined
): "gcs" | "local_disk" | "other_remote" | "none" {
  if (!url) return "none";
  if (isGcsUrl(url)) return "gcs";
  if (url.startsWith("local://")) return "local_disk";
  return "other_remote";
}
