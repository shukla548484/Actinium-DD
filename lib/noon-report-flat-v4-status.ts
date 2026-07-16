import type { Prisma } from "@prisma/client";

/** Flat V4 noon report status workflow (aligned with V2, without SENT). */

export const FLAT_V4_STATUSES = [
  "DRAFT",
  "READY",
  "MASTER_APPROVED",
  "MASTER_RE_APPROVED",
  "RETURNED",
  "APPROVED",
] as const;

export type FlatV4ReportStatus = (typeof FLAT_V4_STATUSES)[number];

/** Statuses where the report has been master-approved and is visible to office. */
export const FLAT_V4_OFFICE_RECEIVED_STATUSES: FlatV4ReportStatus[] = [
  "MASTER_APPROVED",
  "MASTER_RE_APPROVED",
];

/** Submitted reports included in analytics/compliance (includes legacy SENT in DB queries). */
export const FLAT_V4_SUBMITTED_STATUSES = [
  "MASTER_APPROVED",
  "MASTER_RE_APPROVED",
  "APPROVED",
  "SENT",
] as const;

export const FLAT_V4_STATUS_LABELS: Record<FlatV4ReportStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  MASTER_APPROVED: "Master approved",
  MASTER_RE_APPROVED: "Master re-approved",
  RETURNED: "Returned",
  APPROVED: "Approved",
};

export const FLAT_V4_ALLOWED_TRANSITIONS: Record<FlatV4ReportStatus, FlatV4ReportStatus[]> = {
  DRAFT: ["READY", "MASTER_APPROVED", "MASTER_RE_APPROVED"],
  READY: ["MASTER_APPROVED", "MASTER_RE_APPROVED", "DRAFT", "RETURNED"],
  MASTER_APPROVED: ["RETURNED", "APPROVED"],
  MASTER_RE_APPROVED: ["RETURNED", "APPROVED"],
  RETURNED: ["READY", "MASTER_APPROVED", "MASTER_RE_APPROVED"],
  APPROVED: [],
};

export function normalizeFlatV4Status(raw: unknown): FlatV4ReportStatus {
  const s = String(raw ?? "DRAFT").trim().toUpperCase();
  if (s === "SENT") return "MASTER_APPROVED";
  return FLAT_V4_STATUSES.includes(s as FlatV4ReportStatus) ? (s as FlatV4ReportStatus) : "DRAFT";
}

export function formatFlatV4StatusLabel(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "SENT") return FLAT_V4_STATUS_LABELS.MASTER_APPROVED;
  const normalized = normalizeFlatV4Status(raw);
  return FLAT_V4_STATUS_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

export function canTransitionFlatV4Status(from: FlatV4ReportStatus, to: FlatV4ReportStatus): boolean {
  return (FLAT_V4_ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Crew can edit fuel/voyage/params when draft, ready, or returned. */
export function isFlatV4ReportEditable(status: FlatV4ReportStatus): boolean {
  return status === "DRAFT" || status === "READY" || status === "RETURNED";
}

/** Office may return a master-approved report. */
export function canReturnFlatV4Report(status: FlatV4ReportStatus): boolean {
  return status === "MASTER_APPROVED" || status === "MASTER_RE_APPROVED";
}

export function isFlatV4OfficeReceived(status: unknown): boolean {
  const s = normalizeFlatV4Status(status);
  return FLAT_V4_OFFICE_RECEIVED_STATUSES.includes(s);
}

export const FLAT_V4_RETURN_ALLOWED_ACCESS_LEVELS = new Set<number>([
  50, 99, 100,
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 40, 42, 43, 45, 46, 47, 48,
  37, 39, 41,
]);

/** First master approval vs re-approval after office return. */
export async function resolveFlatV4MasterApprovalTarget(
  tx: Prisma.TransactionClient,
  reportId: string,
  from: FlatV4ReportStatus
): Promise<"MASTER_APPROVED" | "MASTER_RE_APPROVED"> {
  if (from === "RETURNED") return "MASTER_RE_APPROVED";
  const everReturned =
    (await tx.noonReportFlatV4StatusHistory.count({
      where: { reportId, newStatus: "RETURNED" },
    })) > 0;
  return everReturned ? "MASTER_RE_APPROVED" : "MASTER_APPROVED";
}

/** @deprecated Use resolveFlatV4MasterApprovalTarget — always resolves to MASTER_APPROVED without history. */
export function resolveFlatV4ReportStatusAfterMasterApproval(): FlatV4ReportStatus {
  return "MASTER_APPROVED";
}
