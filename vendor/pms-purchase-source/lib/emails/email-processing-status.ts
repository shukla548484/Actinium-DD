import { prisma } from "@/lib/prisma";

/** Quote/email import lifecycle — distinct from `processed` and `emailType`. */
export const EmailProcessingStatus = {
  RECEIVED: "RECEIVED",
  MATCHED: "MATCHED",
  IMPORTED: "IMPORTED",
  FAILED: "FAILED",
} as const;

export type EmailProcessingStatusValue =
  (typeof EmailProcessingStatus)[keyof typeof EmailProcessingStatus];

type StatusUpdate = {
  processingStatus: EmailProcessingStatusValue;
  lastProcessingError?: string | null;
  relatedQuoteId?: string | null;
  relatedRequisitionId?: string | null;
  emailType?: string | null;
  processed?: boolean;
  processedAt?: Date | null;
};

function isMissingProcessingStatusColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /processing_status|last_processing_error|42703|does not exist/i.test(msg);
}

export async function setEmailProcessingStatus(
  emailId: string,
  data: StatusUpdate
): Promise<void> {
  const payload: Record<string, unknown> = {
    processingStatus: data.processingStatus,
    lastProcessingError: data.lastProcessingError ?? null,
  };
  if (data.relatedQuoteId !== undefined) payload.relatedQuoteId = data.relatedQuoteId;
  if (data.relatedRequisitionId !== undefined) {
    payload.relatedRequisitionId = data.relatedRequisitionId;
  }
  if (data.emailType !== undefined) payload.emailType = data.emailType;
  if (data.processed !== undefined) payload.processed = data.processed;
  if (data.processedAt !== undefined) payload.processedAt = data.processedAt;

  try {
    await prisma.emailMessage.update({
      where: { id: emailId },
      data: payload,
    });
  } catch (err) {
    if (!isMissingProcessingStatusColumn(err)) {
      throw err;
    }
    const { processingStatus: _s, lastProcessingError: _e, ...legacyPayload } = payload;
    if (Object.keys(legacyPayload).length === 0) {
      return;
    }
    await prisma.emailMessage.update({
      where: { id: emailId },
      data: legacyPayload,
    });
  }
}

export async function markEmailReceived(emailId: string): Promise<void> {
  await setEmailProcessingStatus(emailId, {
    processingStatus: EmailProcessingStatus.RECEIVED,
    lastProcessingError: null,
  });
}

export async function markEmailMatched(
  emailId: string,
  relatedQuoteId: string,
  relatedRequisitionId: string
): Promise<void> {
  await setEmailProcessingStatus(emailId, {
    processingStatus: EmailProcessingStatus.MATCHED,
    lastProcessingError: null,
    relatedQuoteId,
    relatedRequisitionId,
    emailType: "QUOTE_RESPONSE",
    processed: false,
    processedAt: null,
  });
}

export async function markEmailImported(emailId: string): Promise<void> {
  await setEmailProcessingStatus(emailId, {
    processingStatus: EmailProcessingStatus.IMPORTED,
    lastProcessingError: null,
    processed: true,
    processedAt: new Date(),
  });
}

export async function markEmailImportFailed(
  emailId: string,
  error: string
): Promise<void> {
  const trimmed = error.trim().slice(0, 4000);
  await setEmailProcessingStatus(emailId, {
    processingStatus: EmailProcessingStatus.FAILED,
    lastProcessingError: trimmed || "Unknown import error",
    processed: false,
    processedAt: null,
  });
}

export function formatEmailProcessingStatusLabel(
  status: string | null | undefined
): string {
  if (!status) return "Unknown";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
