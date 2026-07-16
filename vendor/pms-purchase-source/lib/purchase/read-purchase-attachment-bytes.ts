import { readFile } from "fs/promises";
import { resolveLocalFilePath } from "@/lib/local-file-resolver";
import {
  classifyPurchaseUrlSource,
  needsPurchaseUrlGcsUpload,
} from "@/lib/purchase/purchase-attachment-utils";

export type PurchaseAttachmentFileSource = "gcs" | "local_disk" | "other_remote" | "none";

export async function readPurchaseAttachmentBytes(
  fileUrl: string | null | undefined
): Promise<Buffer | null> {
  if (!fileUrl?.startsWith("local://")) return null;
  try {
    return await readFile(resolveLocalFilePath(fileUrl));
  } catch {
    return null;
  }
}

export function needsPurchaseAttachmentGcsUpload(
  fileUrl: string | null | undefined
): boolean {
  return needsPurchaseUrlGcsUpload(fileUrl);
}

export function classifyPurchaseAttachmentSource(
  fileUrl: string | null | undefined
): PurchaseAttachmentFileSource {
  return classifyPurchaseUrlSource(fileUrl);
}

export {
  extractPurchaseAttachmentUrls,
  replacePurchaseAttachmentUrl,
} from "@/lib/purchase/purchase-attachment-utils";
