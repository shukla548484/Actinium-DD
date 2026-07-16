import {
  validateCompanyAccess,
  validateVesselAccess,
  type SecureRequestContext,
} from "@/lib/api-security";
import { prisma } from "@/lib/prisma";
import { getMasterCompanyIds } from "@/lib/company-hierarchy";
import { isPoTierApproverLevel, isPoConfirmPurchaserLevel } from "@/lib/procurement/po-confirm-access";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

type PoVesselRef = {
  id: string;
  companyId: string | null;
};

/**
 * Access check for PO mutations (approve, reject, cancel, modify).
 * Shore tier approvers and purchasers may belong to a parent company or be
 * vessel-assigned while the PO vessel sits in a subsidiary — strict companyId
 * equality alone is too narrow.
 */
export async function validatePoResourceAccess(
  context: SecureRequestContext,
  vessel: PoVesselRef | null | undefined,
  resourceId?: string
): Promise<boolean> {
  if (!vessel?.id) return false;

  if (vessel.companyId) {
    const companyOk = await validateCompanyAccess(context, vessel.companyId, resourceId);
    if (companyOk) return true;

    const userCompanyId = context.companyId;
    const masterCompanyId =
      typeof (context.user as { masterCompanyId?: string | null }).masterCompanyId === "string"
        ? (context.user as { masterCompanyId: string }).masterCompanyId
        : null;
    const companyRoots = [...new Set([userCompanyId, masterCompanyId].filter(Boolean))] as string[];

    for (const rootId of companyRoots) {
      const hierarchyIds = await getMasterCompanyIds(prisma, rootId);
      if (hierarchyIds.includes(vessel.companyId)) return true;
    }

    if (vessel.companyId) {
      const vesselHierarchyIds = await getMasterCompanyIds(prisma, vessel.companyId);
      if (companyRoots.some((rootId) => vesselHierarchyIds.includes(rootId))) return true;
    }
  }

  const level = context.user.designationAccessLevel ?? 0;
  const isShoreProcurementActor =
    isAdminEquivalentAccessLevel(level) ||
    isPoTierApproverLevel(level) ||
    isPoConfirmPurchaserLevel(level);

  if (isShoreProcurementActor) {
    return validateVesselAccess(context, vessel.id);
  }

  return false;
}
