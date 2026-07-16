import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { getLocalStorageBaseDir, resolveLocalFilePath } from "@/lib/local-file-resolver";
import {
  buildLocalAttachmentRelativePath,
  isRuleBasedLocalAttachmentPath,
  localAttachmentFolderFromFileUrl,
  newLocalAttachmentId,
  toLocalFileUrl,
  type LocalAttachmentModule,
  type LocalAttachmentPathParams,
} from "@/lib/attachments/local-attachment-layout";

export type StoreLocalAttachmentParams = Omit<LocalAttachmentPathParams, "attachmentId"> & {
  attachmentId?: string;
};

export type StoredLocalAttachment = {
  fileUrl: string;
  relativePath: string;
  absolutePath: string;
  attachmentId: string;
  attachmentFolder: string;
  storedFileName: string;
};

function absolutePathForRelative(relativePath: string): string {
  return path.join(getLocalStorageBaseDir(), relativePath);
}

/**
 * Copy bytes into the rule-based application attachment folder and return local:// URL.
 * Always writes under uploads/attachments/… — never references the user's original path.
 */
export async function storeLocalAttachmentBuffer(params: {
  buffer: Buffer;
  pathParams: StoreLocalAttachmentParams;
}): Promise<StoredLocalAttachment> {
  const attachmentId = params.pathParams.attachmentId ?? newLocalAttachmentId();
  const built = buildLocalAttachmentRelativePath({
    ...params.pathParams,
    attachmentId,
  });
  const absolutePath = absolutePathForRelative(built.relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.buffer);

  return {
    fileUrl: toLocalFileUrl(built.relativePath),
    relativePath: built.relativePath,
    absolutePath,
    attachmentId,
    attachmentFolder: built.attachmentFolder,
    storedFileName: built.storedFileName,
  };
}

/** Read upload into memory, then store under the canonical attachment folder. */
export async function storeLocalAttachmentFromUpload(params: {
  file: File;
  module: LocalAttachmentModule;
  vesselId: string;
  entityId: string;
  attachmentId?: string;
  uploadedByUserId?: string | null;
  subKind?: string | null;
  /** When set, used for on-disk name + path instead of the browser file name. */
  storedFileName?: string | null;
}): Promise<StoredLocalAttachment & { buffer: Buffer }> {
  const arrayBuffer = await params.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stored = await storeLocalAttachmentBuffer({
    buffer,
    pathParams: {
      module: params.module,
      vesselId: params.vesselId,
      entityId: params.entityId,
      attachmentId: params.attachmentId,
      originalFileName: params.storedFileName?.trim() || params.file.name || "attachment",
      uploadedByUserId: params.uploadedByUserId,
      subKind: params.subKind,
    },
  });
  return { ...stored, buffer };
}

/**
 * Copy an existing file on disk into the canonical attachment folder (server-side temp paths).
 */
export async function copyFileIntoLocalAttachmentStore(params: {
  sourceAbsolutePath: string;
  pathParams: StoreLocalAttachmentParams;
}): Promise<StoredLocalAttachment> {
  const attachmentId = params.pathParams.attachmentId ?? newLocalAttachmentId();
  const built = buildLocalAttachmentRelativePath({
    ...params.pathParams,
    attachmentId,
    originalFileName:
      params.pathParams.originalFileName || path.basename(params.sourceAbsolutePath),
  });
  const absolutePath = absolutePathForRelative(built.relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await copyFile(params.sourceAbsolutePath, absolutePath);

  return {
    fileUrl: toLocalFileUrl(built.relativePath),
    relativePath: built.relativePath,
    absolutePath,
    attachmentId,
    attachmentFolder: built.attachmentFolder,
    storedFileName: built.storedFileName,
  };
}

/** Delete attachment file; removes empty rule-based attachment folder when applicable. */
export async function deleteLocalAttachmentAtUrl(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("local://")) return;
  const filePath = resolveLocalFilePath(fileUrl);
  try {
    await unlink(filePath);
  } catch {
    return;
  }

  const folder = localAttachmentFolderFromFileUrl(fileUrl);
  if (!folder || !isRuleBasedLocalAttachmentPath(folder)) return;

  const folderAbs = absolutePathForRelative(folder);
  try {
    const { rmdir } = await import("fs/promises");
    await rmdir(folderAbs);
  } catch {
    /* folder not empty or already gone */
  }
}

export { newLocalAttachmentId };
