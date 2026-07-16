import "server-only";

import path from "path";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";

/** Folder name: files_and_attachments_{IMO} or files_and_attachments_{vessel_code}. */
export function defaultLocalAttachmentFolderName(): string {
  const imo = (process.env.VESSEL_IMO_NUMBER ?? "").trim().replace(/\D/g, "");
  if (imo) return `files_and_attachments_${imo}`;

  const code = (process.env.VESSEL_CODE ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (code) return `files_and_attachments_${code}`;

  return "uploads";
}

/** Explicit path from env (LOCAL_STORAGE_PATH or LOCAL_FILE_STORAGE_PATH alias). */
export function explicitLocalStoragePathFromEnv(): string | undefined {
  const raw =
    process.env.LOCAL_STORAGE_PATH?.trim() ||
    process.env.LOCAL_FILE_STORAGE_PATH?.trim();
  return raw || undefined;
}

/**
 * Resolve absolute attachment root for ship local deployment.
 * Relative paths resolve against process.cwd() (local-app/ when running pnpm local-app:dev).
 */
export function resolveLocalStorageDir(): string {
  const explicit = explicitLocalStoragePathFromEnv();
  if (explicit) {
    return path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
  }

  if (isLocalDeployment()) {
    return path.resolve(process.cwd(), defaultLocalAttachmentFolderName());
  }

  return path.resolve(process.cwd(), "uploads");
}

/** Keep LOCAL_STORAGE_PATH / LOCAL_FILE_STORAGE_PATH aligned for legacy readers. */
export function syncLocalStorageEnvVars(absoluteDir: string): void {
  process.env.LOCAL_STORAGE_PATH = absoluteDir;
  process.env.LOCAL_FILE_STORAGE_PATH = absoluteDir;
}
