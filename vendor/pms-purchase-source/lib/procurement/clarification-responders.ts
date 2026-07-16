import type { PrismaClient } from "@prisma/client";

/** Requisition created by Master / CE / senior officers → CE or Master may reply. */
const CREATOR_GROUP_SENIOR = new Set([25, 23, 22, 21]);
/** Requisition created by 2nd Eng / shore purchase band → 2nd Eng or shore purchase may reply. */
const CREATOR_GROUP_MIDDLE = new Set([24, 20, 19, 18]);
/** Levels allowed to reply for each creator group. */
const RESPONDERS_SENIOR = [25, 23] as const;
const RESPONDERS_MIDDLE = [24, 20] as const;
const RESPONDERS_JUNIOR_CREATOR = [17, 25, 24] as const;
/** Office-created requisitions: notify senior vessel responders. */
const RESPONDERS_OFFICE_CREATOR = [25, 24, 23, 20] as const;

/** Shore-side levels that may respond without a vessel assignment row. */
const SHORE_RESPONDER_LEVELS = new Set([20, 23, 24, 25]);

export function getEligibleResponderAccessLevels(creatorAccessLevel: number): number[] {
  if (CREATOR_GROUP_SENIOR.has(creatorAccessLevel)) {
    return [...RESPONDERS_SENIOR];
  }
  if (CREATOR_GROUP_MIDDLE.has(creatorAccessLevel)) {
    return [...RESPONDERS_MIDDLE];
  }
  if (creatorAccessLevel === 17) {
    return [...RESPONDERS_JUNIOR_CREATOR];
  }
  if (creatorAccessLevel > 25) {
    return [...RESPONDERS_OFFICE_CREATOR];
  }
  // Other junior vessel ranks follow the 3rd Engineer pathway.
  return [...RESPONDERS_JUNIOR_CREATOR];
}

export function canEmployeeRespondToClarification(
  responderAccessLevel: number,
  creatorAccessLevel: number
): boolean {
  return getEligibleResponderAccessLevels(creatorAccessLevel).includes(responderAccessLevel);
}

export async function getRequisitionCreatorAccessLevel(
  db: Pick<PrismaClient, "requisition">,
  requisitionId: string
): Promise<number | null> {
  const row = await db.requisition.findUnique({
    where: { id: requisitionId },
    select: { createdBy: { select: { designationAccessLevel: true } } },
  });
  return row?.createdBy?.designationAccessLevel ?? null;
}

/** Employee IDs eligible to answer a vendor clarification for this requisition/vessel. */
export async function findRfqClarificationResponderIds(
  db: Pick<PrismaClient, "employee">,
  vesselId: string,
  creatorAccessLevel: number
): Promise<string[]> {
  const eligibleLevels = getEligibleResponderAccessLevels(creatorAccessLevel);
  if (!eligibleLevels.length) return [];

  const vesselLevels = eligibleLevels.filter((level) => !SHORE_RESPONDER_LEVELS.has(level) || level <= 25);
  const shoreLevels = eligibleLevels.filter((level) => SHORE_RESPONDER_LEVELS.has(level));

  const [vesselAssigned, shoreStaff] = await Promise.all([
    vesselLevels.length
      ? db.employee.findMany({
          where: {
            isActive: true,
            designationAccessLevel: { in: vesselLevels },
            assignedVessels: {
              some: { vesselId, signOffDate: null },
            },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    shoreLevels.length
      ? db.employee.findMany({
          where: {
            isActive: true,
            designationAccessLevel: { in: shoreLevels },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return [...new Set([...vesselAssigned, ...shoreStaff].map((e) => e.id))];
}

/** Mark open clarification task alerts as read once any eligible user responds. */
export async function dismissClarificationTaskNotifications(
  db: Pick<PrismaClient, "operationNotification">,
  clarificationId: string
) {
  await db.operationNotification.updateMany({
    where: {
      entityType: "RfqClarification",
      entityId: clarificationId,
      operation: { in: ["RFQ_CLARIFICATION_REQUESTED", "RFQ_CLARIFICATION_ESCALATED"] },
      isRead: false,
    },
    data: { isRead: true },
  });
}
