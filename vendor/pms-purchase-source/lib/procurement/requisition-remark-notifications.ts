import "server-only";

import prisma from "@/lib/prisma";
import {
  isRequisitionVisibleToViewer,
  type RequisitionVisibilityRow,
} from "@/lib/requisition-list-access";
import type { GenerationStatus, RequisitionStatus } from "@/lib/types/requisition";

export const REQUISITION_REMARK_ADDED_OPERATION = "REQUISITION_REMARK_ADDED";
export const REQUISITION_REMARK_UPDATED_OPERATION = "REQUISITION_REMARK_UPDATED";

export const REQUISITION_REMARK_ENTITY_TYPE = "Requisition";

function remarkPreview(text: string, max = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function requisitionRemarksActionUrl(requisitionId: string): string {
  const params = new URLSearchParams({
    openRequisitionId: requisitionId,
    modalTab: "remarks",
  });
  return `/purchase/view-requisitions?${params.toString()}`;
}

type RequisitionNotifyContext = RequisitionVisibilityRow & {
  id: string;
  requisitionNumber: string;
  vesselId: string;
  vessel: { companyId: string | null; name: string };
  status: RequisitionStatus;
  generationStatus: GenerationStatus;
};

/** Users who can see this requisition in lists/detail (excluding the actor). */
export async function findRequisitionAccessRecipientIds(
  requisition: RequisitionNotifyContext,
  excludeUserId?: string
): Promise<string[]> {
  const companyId = requisition.vessel.companyId;
  const vesselId = requisition.vesselId;

  const visibilityRow: RequisitionVisibilityRow = {
    status: requisition.status,
    generationStatus: requisition.generationStatus,
    requisitionNumber: requisition.requisitionNumber,
    createdById: requisition.createdById,
    createdBy: requisition.createdBy,
  };

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(companyId ? { companyId } : {}),
      OR: [
        { designationAccessLevel: { in: [50, 99, 100] } },
        {
          designationAccessLevel: { gte: 26, lte: 48 },
          assignedModules: {
            some: {
              module: {
                name: { equals: "Purchase", mode: "insensitive" },
              },
            },
          },
        },
        {
          designationAccessLevel: { gte: 6, lte: 25 },
          assignedVessels: {
            some: {
              vesselId,
              OR: [{ signOffDate: null }, { signOffDate: { gt: new Date() } }],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      designationAccessLevel: true,
    },
  });

  const ids = employees
    .filter((employee) =>
      isRequisitionVisibleToViewer(visibilityRow, {
        viewerId: employee.id,
        viewerAccessLevel: employee.designationAccessLevel ?? undefined,
      })
    )
    .map((employee) => employee.id)
    .filter((id) => id !== excludeUserId);

  return [...new Set(ids)];
}

export async function notifyRequisitionRemarkAdded(params: {
  requisition: RequisitionNotifyContext;
  remarkId: string;
  remarkText: string;
  actorUserId: string;
  actorName: string;
}): Promise<{ created: number }> {
  return notifyRequisitionRemarkEvent({
    ...params,
    operation: REQUISITION_REMARK_ADDED_OPERATION,
    title: "New requisition remark",
    verb: "added a remark on",
  });
}

export async function notifyRequisitionRemarkUpdated(params: {
  requisition: RequisitionNotifyContext;
  remarkId: string;
  remarkText: string;
  actorUserId: string;
  actorName: string;
}): Promise<{ created: number }> {
  return notifyRequisitionRemarkEvent({
    ...params,
    operation: REQUISITION_REMARK_UPDATED_OPERATION,
    title: "Requisition remark updated",
    verb: "updated a remark on",
  });
}

async function notifyRequisitionRemarkEvent(params: {
  requisition: RequisitionNotifyContext;
  remarkId: string;
  remarkText: string;
  actorUserId: string;
  actorName: string;
  operation: string;
  title: string;
  verb: string;
}): Promise<{ created: number }> {
  try {
    const recipientIds = await findRequisitionAccessRecipientIds(
      params.requisition,
      params.actorUserId
    );
    if (recipientIds.length === 0) return { created: 0 };

    const preview = remarkPreview(params.remarkText);
    const message = `${params.actorName} ${params.verb} ${params.requisition.requisitionNumber}${
      preview ? `: ${preview}` : "."
    }`;

    await prisma.operationNotification.createMany({
      data: recipientIds.map((userId) => ({
        title: params.title,
        message,
        type: "COMMENT_ADDED",
        operation: params.operation,
        entityType: REQUISITION_REMARK_ENTITY_TYPE,
        entityId: params.remarkId,
        userId,
        isRead: false,
        metadata: {
          actionUrl: requisitionRemarksActionUrl(params.requisition.id),
          requisitionId: params.requisition.id,
          requisitionNumber: params.requisition.requisitionNumber,
          vesselId: params.requisition.vesselId,
          vesselName: params.requisition.vessel.name,
          remarkId: params.remarkId,
        },
      })),
    });

    return { created: recipientIds.length };
  } catch (error) {
    console.error(`[${params.operation}]`, error);
    return { created: 0 };
  }
}
