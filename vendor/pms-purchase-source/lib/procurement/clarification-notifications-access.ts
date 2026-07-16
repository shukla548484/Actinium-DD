import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { canEmployeeRespondToClarification } from "@/lib/procurement/clarification-responders";

const PURCHASE_ACCESS = new Set([32, 33, 39]);

export function canManagePurchaseClarifications(accessLevel?: number | null): boolean {
  if (accessLevel == null) return false;
  return PURCHASE_ACCESS.has(accessLevel) || isAdminEquivalentAccessLevel(accessLevel);
}

/** Whether this employee may submit the vessel clarification response. */
export function canRespondToVesselClarification(
  responderAccessLevel?: number | null,
  creatorAccessLevel?: number | null
): boolean {
  if (responderAccessLevel == null || creatorAccessLevel == null) return false;
  return canEmployeeRespondToClarification(responderAccessLevel, creatorAccessLevel);
}

export function buildVesselVisibleClarificationMessage(message: string): string {
  return message
    .replace(/\b(vendor|supplier)\b/gi, "quoting party")
    .trim();
}
