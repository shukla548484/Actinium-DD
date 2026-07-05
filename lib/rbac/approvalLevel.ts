/**
 * Approval authority rules driven by designation approval level (1–5).
 * Higher level = authority to sign off larger decisions.
 */

export type ApprovalDomain =
  | "defect"
  | "requisition"
  | "purchase_order"
  | "variation"
  | "budget"
  | "tender_award";

/** Minimum approval level required per domain (base threshold). */
export const APPROVAL_DOMAIN_MIN_LEVEL: Record<ApprovalDomain, number> = {
  defect: 1,
  requisition: 2,
  purchase_order: 3,
  variation: 3,
  budget: 4,
  tender_award: 5,
};

/** Optional monetary thresholds (USD) requiring elevated approval. */
export const APPROVAL_AMOUNT_THRESHOLDS: { maxAmount: number; minLevel: number }[] = [
  { maxAmount: 5_000, minLevel: 2 },
  { maxAmount: 25_000, minLevel: 3 },
  { maxAmount: 100_000, minLevel: 4 },
  { maxAmount: Number.POSITIVE_INFINITY, minLevel: 5 },
];

export function requiredApprovalLevel(
  domain: ApprovalDomain,
  amountUsd = 0,
): number {
  const base = APPROVAL_DOMAIN_MIN_LEVEL[domain];
  let amountLevel = 1;
  for (const tier of APPROVAL_AMOUNT_THRESHOLDS) {
    if (amountUsd <= tier.maxAmount) {
      amountLevel = tier.minLevel;
      break;
    }
  }
  return Math.max(base, amountLevel);
}

export function canApproveAtLevel(
  actorApprovalLevel: number,
  domain: ApprovalDomain,
  amountUsd = 0,
): boolean {
  return actorApprovalLevel >= requiredApprovalLevel(domain, amountUsd);
}

export function approvalLevelLabel(level: number): string {
  return `A${level}`;
}
