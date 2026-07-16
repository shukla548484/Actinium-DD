import "server-only";

import * as path from "path";
import * as fs from "fs";
import { resolveLocalStorageDir } from "@/lib/local-storage-path";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";

const GCS_HOSTS = ["storage.googleapis.com", "storage.cloud.google.com"];

/** Absolute base directory for local uploads (defect attachments, gcs-mirror, etc.). */
export function getLocalStorageBaseDir(): string {
  return resolveLocalStorageDir();
}

/** Extra ship storage roots (IMO folder, legacy uploads) when cwd is repo root. */
function legacyLocalStorageRoots(): string[] {
  const roots: string[] = [];
  const cwd = process.cwd();
  const localApp = path.join(cwd, "local-app");
  if (fs.existsSync(localApp)) {
    try {
      for (const entry of fs.readdirSync(localApp)) {
        if (entry.startsWith("files_and_attachments_")) {
          roots.push(path.join(localApp, entry));
        }
      }
    } catch {
      /* ignore */
    }
    roots.push(path.join(localApp, "uploads"));
  }
  roots.push(path.join(cwd, "uploads"));
  return roots;
}

/**
 * Resolves a `local://` fileUrl to an absolute filesystem path.
 *
 * Tries multiple resolution strategies to handle differences between
 * the upload context (defect-attachment-storage.ts) which saves files at:
 *   <uploads>/defects/<defectId>/attachments/<type>/DEFECT_<code>_<type>_<date>_<name>
 * and various CWD / env-var configurations.
 *
 * Returns the first path that exists on disk, or the primary resolved path
 * if none exist (caller should handle ENOENT).
 */
export function resolveLocalFilePath(fileUrl: string): string {
  let localKey: string;
  if (fileUrl.startsWith("local://")) {
    localKey = fileUrl.slice("local://".length);
  } else if (fileUrl.startsWith("/api/files/")) {
    localKey = fileUrl.slice("/api/files/".length);
  } else {
    localKey = fileUrl;
  }

  // URL-decode in case the path was percent-encoded during transit
  try {
    const decoded = decodeURIComponent(localKey);
    if (decoded !== localKey) localKey = decoded;
  } catch { /* keep original if decode fails */ }

  const baseDir = getLocalStorageBaseDir();
  const primaryPath = path.join(baseDir, localKey);

  if (fs.existsSync(primaryPath)) return primaryPath;

  // Rule-based layout: attachments/{vessel}/{module}/…
  if (localKey.startsWith("attachments/")) {
    return primaryPath;
  }

  // Build a list of candidate paths covering common layout variations.
  const candidates: string[] = [
    path.resolve(process.cwd(), "uploads", localKey),
    path.resolve(process.cwd(), localKey),
  ];
  for (const root of legacyLocalStorageRoots()) {
    candidates.push(path.join(root, localKey));
  }

  // The upload function saves under …/attachments/<type>/… but the download
  // function saves under …/<type>/… (no "attachments" segment).  Try both.
  if (localKey.includes("/attachments/")) {
    const withoutAttachments = localKey.replace("/attachments/", "/");
    candidates.push(path.join(baseDir, withoutAttachments));
    candidates.push(path.resolve(process.cwd(), "uploads", withoutAttachments));
  } else {
    // Conversely, try inserting the "attachments" segment.
    const m = localKey.match(/^(defects\/[^/]+)\/(reporting|closer|ra)\//);
    if (m) {
      const withAttachments = localKey.replace(
        `${m[1]}/${m[2]}/`,
        `${m[1]}/attachments/${m[2]}/`
      );
      candidates.push(path.join(baseDir, withAttachments));
      candidates.push(path.resolve(process.cwd(), "uploads", withAttachments));
    }
  }

  for (const candidate of candidates) {
    if (candidate !== primaryPath && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort: scan the expected directory for a file whose name matches
  // the basename (handles cases where intermediate path segments differ).
  const fileName = path.basename(localKey);
  if (fileName) {
    const searchRoots = [
      path.join(baseDir, "attachments"),
      path.join(baseDir, "defects"),
      ...legacyLocalStorageRoots().flatMap((root) => [
        path.join(root, "attachments"),
        path.join(root, "defects"),
      ]),
      path.resolve(process.cwd(), "uploads", "defects"),
      path.resolve(process.cwd(), "uploads", "attachments"),
    ];
    for (const root of searchRoots) {
      const found = findFileRecursive(root, fileName, 4);
      if (found) return found;
    }
  }

  return primaryPath;
}

/**
 * Recursively search for a file by exact basename, up to `maxDepth` levels.
 * Returns the first match or null.
 */
function findFileRecursive(
  dir: string,
  targetName: string,
  maxDepth: number
): string | null {
  if (maxDepth <= 0 || !fs.existsSync(dir)) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === targetName) {
      return path.join(dir, entry.name);
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findFileRecursive(
        path.join(dir, entry.name),
        targetName,
        maxDepth - 1
      );
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extracts the GCS object path (bucket-relative) from a full GCS URL.
 * Returns null if the URL is not a GCS URL.
 *
 * Example:
 *   "https://storage.googleapis.com/actinium_sm/defects/abc/file.pdf"
 *   => "defects/abc/file.pdf"
 */
export function extractGcsObjectPath(fileUrl: string): string | null {
  for (const host of GCS_HOSTS) {
    if (!fileUrl.includes(host)) continue;
    const parts = fileUrl.split(`${host}/`);
    if (parts.length < 2) return null;
    const afterHost = parts[1];
    const slashIdx = afterHost.indexOf("/");
    if (slashIdx < 0) return null;
    return decodeURIComponent(afterHost.slice(slashIdx + 1));
  }
  return null;
}

export function isGcsUrl(fileUrl: string): boolean {
  return GCS_HOSTS.some((h) => fileUrl.includes(h));
}

/**
 * Derives a local filesystem path for a given GCS object path.
 * Uses a `gcs-mirror/` subdirectory to avoid conflicts with user-uploaded local files.
 */
export function localPathForGcsObject(gcsObjectPath: string): string {
  const safePath = gcsObjectPath.replace(/\.\./g, "_");
  return path.join(getLocalStorageBaseDir(), "gcs-mirror", safePath);
}

/**
 * For DEPLOYMENT_ROLE=local, attempts to resolve a file URL to a local file.
 * Handles both GCS URLs (via gcs-mirror) and local:// URLs.
 * Returns the file Buffer if found locally, or null if not available.
 *
 * This should be used by all download routes to avoid hitting GCS on the ship.
 */
export async function resolveFileLocally(fileUrl: string): Promise<Buffer | null> {
  if (!isLocalDeployment()) return null;

  if (fileUrl.startsWith("local://") || fileUrl.startsWith("/api/files/")) {
    const filePath = resolveLocalFilePath(fileUrl);
    if (!fs.existsSync(filePath)) return null;
    const { readFile } = await import("fs/promises");
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  if (!isGcsUrl(fileUrl)) return null;

  const objectPath = extractGcsObjectPath(fileUrl);
  if (!objectPath) return null;

  const localPath = localPathForGcsObject(objectPath);

  if (!fs.existsSync(localPath)) return null;

  const { readFile } = await import("fs/promises");
  try {
    return await readFile(localPath);
  } catch {
    return null;
  }
}

/**
 * Saves a buffer to the local GCS mirror path.
 * Used during vessel sync to cache GCS files on the ship.
 */
export async function saveFileLocally(gcsObjectPath: string, buffer: Buffer): Promise<string> {
  const localPath = localPathForGcsObject(gcsObjectPath);
  const { mkdir, writeFile } = await import("fs/promises");
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, buffer);
  return localPath;
}

/**
 * Returns whether the current deployment should serve files from local storage
 * instead of attempting to reach GCS.
 */
export function shouldServeLocally(): boolean {
  return isLocalDeployment();
}
