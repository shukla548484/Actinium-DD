const MAX_REMARK_LENGTH = 300;

/** Trim and cap rejection/return remarks for notification copy. */
export function truncateRejectionRemarks(remarks?: string | null): string | null {
  if (!remarks?.trim()) return null;
  const trimmed = remarks.trim();
  if (trimmed.length <= MAX_REMARK_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_REMARK_LENGTH)}…`;
}

/** Inline suffix for activity log messages, e.g. ` Remarks: "return"`. */
export function rejectionRemarksSuffix(remarks?: string | null): string {
  const text = truncateRejectionRemarks(remarks);
  return text ? ` Remarks: "${text}"` : "";
}

/** Pull the first non-empty remark field from notification metadata. */
export function remarksFromMetadata(meta: Record<string, unknown>): string | null {
  for (const key of [
    "rejectionComments",
    "returnRemarks",
    "returnComments",
    "reason",
    "remarks",
  ]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      return truncateRejectionRemarks(value);
    }
  }
  return null;
}
