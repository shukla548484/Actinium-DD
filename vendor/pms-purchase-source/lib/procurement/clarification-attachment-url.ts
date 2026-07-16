import { isGcsUrl } from "@/lib/local-file-resolver";
import {
  isLocalRequisitionFileUrl,
  toServableRequisitionAttachmentUrl,
} from "@/lib/requisitions/requisition-attachment-storage";

export function toServableClarificationAttachmentUrl(params: {
  attachmentId: string;
  fileUrl: string | null | undefined;
  view: "office" | "vessel" | "vendor";
  vendorQuoteId?: string | null;
}): string | null {
  const { attachmentId, fileUrl, view, vendorQuoteId } = params;
  if (!fileUrl) return null;

  if (isLocalRequisitionFileUrl(fileUrl)) {
    if (view === "vendor" && vendorQuoteId) {
      return `/api/vendor-auth/rfqs/${vendorQuoteId}/clarification-attachments/${attachmentId}`;
    }
    return toServableRequisitionAttachmentUrl(fileUrl);
  }

  if (fileUrl.startsWith("/api/")) {
    return fileUrl;
  }

  if (isGcsUrl(fileUrl) || fileUrl.includes("storage.googleapis.com")) {
    if (view === "vendor" && vendorQuoteId) {
      return `/api/vendor-auth/rfqs/${vendorQuoteId}/clarification-attachments/${attachmentId}`;
    }
    return `/api/rfq-clarifications/attachments/${attachmentId}`;
  }

  if (view === "vendor" && vendorQuoteId) {
    return `/api/vendor-auth/rfqs/${vendorQuoteId}/clarification-attachments/${attachmentId}`;
  }
  return `/api/rfq-clarifications/attachments/${attachmentId}`;
}
