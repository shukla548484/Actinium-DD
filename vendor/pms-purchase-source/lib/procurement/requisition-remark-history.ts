import type { PurchaseHistory } from "@prisma/client";

export type RequisitionRemarkUpdateMeta = {
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
};

export function parseRemarkUpdateMeta(
  newValue: string | null | undefined
): RequisitionRemarkUpdateMeta | null {
  if (!newValue) return null;
  try {
    const parsed = JSON.parse(newValue) as Partial<RequisitionRemarkUpdateMeta>;
    if (
      typeof parsed.updatedAt === "string" &&
      typeof parsed.updatedById === "string" &&
      typeof parsed.updatedByName === "string"
    ) {
      return {
        updatedAt: parsed.updatedAt,
        updatedById: parsed.updatedById,
        updatedByName: parsed.updatedByName,
      };
    }
  } catch {
    // ignore malformed metadata
  }
  return null;
}

export function mapPurchaseHistoryToRemark(entry: PurchaseHistory & {
  performedBy: { id: string; firstName: string; lastName: string };
}) {
  const updateMeta = parseRemarkUpdateMeta(entry.newValue);
  return {
    id: entry.id,
    remark: entry.comments || entry.actionDescription || "",
    createdBy: entry.performedBy,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: updateMeta?.updatedAt ?? null,
    updatedBy: updateMeta
      ? {
          id: updateMeta.updatedById,
          firstName: updateMeta.updatedByName.split(" ")[0] ?? updateMeta.updatedByName,
          lastName: updateMeta.updatedByName.split(" ").slice(1).join(" "),
        }
      : null,
  };
}
