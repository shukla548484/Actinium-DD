import { randomUUID } from "crypto";
import path from "path";

/** Root folder under LOCAL_STORAGE_PATH / uploads for all ship-local attachment files. */
export const LOCAL_ATTACHMENT_ROOT = "attachments";

export type LocalAttachmentModule =
  | "defects"
  | "requisitions"
  | "purchase"
  | "hseq"
  | "inspections"
  | "certificates"
  | "technical"
  | "crewing";

export type LocalAttachmentPathParams = {
  module: LocalAttachmentModule;
  vesselId: string;
  /** Parent record the file is linked to (defect id, requisition item id, PO id, …). */
  entityId: string;
  /** One dedicated folder per attachment row. */
  attachmentId: string;
  originalFileName: string;
  uploadedByUserId?: string | null;
  /** Module-specific kind: reporting, item, invoice, investigation, … */
  subKind?: string | null;
  createdAt?: Date;
};

export function newLocalAttachmentId(): string {
  return randomUUID();
}

export function resolveVesselStorageKey(vesselId?: string | null): string {
  const raw =
    vesselId?.trim() ||
    process.env.VESSEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_VESSEL_ID?.trim() ||
    "unknown-vessel";
  return sanitizePathSegment(raw);
}

export function sanitizePathSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (cleaned || "unknown").slice(0, 80);
}

export function sanitizeStoredFileName(originalFileName: string): string {
  const base = path.basename(originalFileName || "attachment");
  const ext = path.extname(base).toLowerCase().slice(0, 12);
  const stem = path.basename(base, path.extname(base));
  const safeStem = stem.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "file";
  return `${safeStem.slice(0, 120)}${ext}`;
}

function userStorageKey(uploadedByUserId?: string | null): string {
  if (!uploadedByUserId?.trim()) return "system";
  return `u_${sanitizePathSegment(uploadedByUserId).slice(0, 12)}`;
}

/**
 * Rule-based layout (each attachment gets its own folder):
 *
 * attachments/{vessel}/{module}/{year}/{month}/{user}/{subKind?}/{entityId}/{attachmentId}/{date}_{file}
 */
export function buildLocalAttachmentRelativePath(params: LocalAttachmentPathParams): {
  relativeDir: string;
  storedFileName: string;
  relativePath: string;
  attachmentFolder: string;
} {
  const at = params.createdAt ?? new Date();
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  const vesselKey = resolveVesselStorageKey(params.vesselId);
  const userKey = userStorageKey(params.uploadedByUserId);
  const entityKey = sanitizePathSegment(params.entityId);
  const attachmentKey = sanitizePathSegment(params.attachmentId);
  const subKind = params.subKind?.trim() ? sanitizePathSegment(params.subKind) : null;

  const segments = [
    LOCAL_ATTACHMENT_ROOT,
    vesselKey,
    params.module,
    year,
    month,
    userKey,
  ];
  if (subKind) segments.push(subKind);
  segments.push(entityKey, attachmentKey);

  const relativeDir = segments.join("/");
  const storedFileName = `${year}${month}${day}_${sanitizeStoredFileName(params.originalFileName)}`;
  const relativePath = `${relativeDir}/${storedFileName}`;
  const attachmentFolder = relativeDir;

  return { relativeDir, storedFileName, relativePath, attachmentFolder };
}

export function toLocalFileUrl(relativePath: string): string {
  return `local://${relativePath.replace(/\\/g, "/")}`;
}

export function isRuleBasedLocalAttachmentPath(relativePath: string): boolean {
  return relativePath.replace(/\\/g, "/").startsWith(`${LOCAL_ATTACHMENT_ROOT}/`);
}

export function localAttachmentFolderFromFileUrl(fileUrl: string): string | null {
  if (!fileUrl.startsWith("local://")) return null;
  const key = fileUrl.slice("local://".length);
  if (!isRuleBasedLocalAttachmentPath(key)) return null;
  return path.dirname(key);
}
