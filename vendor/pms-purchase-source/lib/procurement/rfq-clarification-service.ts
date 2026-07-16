import prisma from "@/lib/prisma";
import type {
  RfqClarificationRequestType,
  RfqClarificationStatus,
} from "@prisma/client";
import { writePlatformAuditEvent } from "@/lib/procurement/platform-audit";
import {
  buildVesselVisibleClarificationMessage,
  notifyClarificationAnswered,
  notifyClarificationCreated,
} from "@/lib/procurement/clarification-notifications";
import { uploadClarificationAttachment } from "@/lib/procurement/clarification-attachment-storage";
import { toServableClarificationAttachmentUrl } from "@/lib/procurement/clarification-attachment-url";
import {
  canEmployeeRespondToClarification,
  dismissClarificationTaskNotifications,
  getRequisitionCreatorAccessLevel,
} from "@/lib/procurement/clarification-responders";
import { parseTablePageSize, type TablePageSize } from "@/lib/table-page-size";
import type { NextRequest } from "next/server";

const clarificationInclude = {
  requisition: {
    select: {
      id: true,
      requisitionNumber: true,
      heading: true,
      vesselId: true,
      createdById: true,
      vessel: { select: { id: true, name: true, code: true, companyId: true } },
      createdBy: { select: { designationAccessLevel: true } },
    },
  },
  requisitionItem: {
    select: {
      id: true,
      itemName: true,
      partNumber: true,
      drawingNumber: true,
      itemNumber: true,
      partName: true,
      machineryInstanceId: true,
    },
  },
  vendor: { select: { id: true, name: true, vendorId: true } },
  vendorQuote: { select: { id: true, quoteNumber: true, status: true } },
  attachments: true,
  answeredBy: { select: { id: true, firstName: true, lastName: true, designation: true } },
  rejectedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export function serializeClarificationForView(
  row: Awaited<ReturnType<typeof getClarificationById>>,
  view: "office" | "vessel" | "vendor"
) {
  if (!row) return null;
  const base = {
    id: row.id,
    vendorQuoteId: row.vendorQuoteId,
    requisitionId: row.requisitionId,
    requisitionItemId: row.requisitionItemId,
    requestType: row.requestType,
    status: row.status,
    requestedAt: row.requestedAt,
    answeredAt: row.answeredAt,
    responseText: row.responseText,
    rejectionReason: row.rejectionReason,
    requisition: row.requisition,
    requisitionItem: row.requisitionItem,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      role: a.role,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      fileUrl: toServableClarificationAttachmentUrl({
        attachmentId: a.id,
        fileUrl: a.fileUrl,
        view,
        vendorQuoteId: row.vendorQuoteId,
      }),
      createdAt: a.createdAt,
    })),
    answeredBy: row.answeredBy,
    rejectedAt: row.rejectedAt,
    closedAt: row.closedAt,
  };

  if (view === "vessel") {
    return {
      ...base,
      message: row.vesselVisibleMessage,
      vendor: undefined,
      answeredBy: undefined,
    };
  }

  if (view === "vendor") {
    return {
      ...base,
      message: row.message,
      vendorQuote: row.vendorQuote,
      answeredBy: undefined,
    };
  }

  return {
    ...base,
    message: row.message,
    vesselVisibleMessage: row.vesselVisibleMessage,
    vendor: row.vendor,
    vendorQuote: row.vendorQuote,
    rejectedBy: row.rejectedBy,
    closedBy: row.closedBy,
    promotedKnowledgePackId: row.promotedKnowledgePackId,
  };
}

export async function getClarificationById(id: string) {
  return prisma.rfqClarificationRequest.findUnique({
    where: { id },
    include: clarificationInclude,
  });
}

export async function listClarifications(params: {
  requisitionId?: string;
  vendorQuoteId?: string;
  vesselId?: string;
  vendorId?: string;
  status?: RfqClarificationStatus;
}) {
  return prisma.rfqClarificationRequest.findMany({
    where: buildClarificationWhere(params),
    include: clarificationInclude,
    orderBy: { requestedAt: "desc" },
  });
}

function buildClarificationWhere(params: {
  requisitionId?: string;
  vendorQuoteId?: string;
  vesselId?: string;
  vendorId?: string;
  status?: RfqClarificationStatus;
}) {
  return {
    ...(params.requisitionId ? { requisitionId: params.requisitionId } : {}),
    ...(params.vendorQuoteId ? { vendorQuoteId: params.vendorQuoteId } : {}),
    ...(params.vesselId ? { vesselId: params.vesselId } : {}),
    ...(params.vendorId ? { vendorId: params.vendorId } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

export async function listClarificationsPaginated(params: {
  requisitionId?: string;
  vendorQuoteId?: string;
  vesselId?: string;
  vendorId?: string;
  status?: RfqClarificationStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = parseTablePageSize(params.pageSize, 5 as TablePageSize);
  const where = buildClarificationWhere(params);

  const [rows, total] = await Promise.all([
    prisma.rfqClarificationRequest.findMany({
      where,
      include: clarificationInclude,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rfqClarificationRequest.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createVendorClarificationRequest(params: {
  vendorQuoteId: string;
  vendorId: string;
  requisitionItemId?: string | null;
  requestType: RfqClarificationRequestType;
  message: string;
  files?: File[];
  request?: NextRequest;
}) {
  const quote = await prisma.vendorQuote.findFirst({
    where: { id: params.vendorQuoteId, vendorId: params.vendorId },
    include: {
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          vesselId: true,
          createdById: true,
          vessel: { select: { id: true, name: true, companyId: true } },
          createdBy: { select: { designationAccessLevel: true } },
        },
      },
    },
  });

  if (!quote?.requisition) {
    throw new Error("RFQ not found");
  }

  if (params.requisitionItemId) {
    const item = await prisma.requisitionItem.findFirst({
      where: {
        id: params.requisitionItemId,
        requisitionId: quote.requisitionId,
      },
    });
    if (!item) throw new Error("Requisition item not found");
  }

  const vesselVisibleMessage = buildVesselVisibleClarificationMessage(params.message);

  const clarification = await prisma.rfqClarificationRequest.create({
    data: {
      vendorQuoteId: quote.id,
      requisitionId: quote.requisitionId,
      requisitionItemId: params.requisitionItemId ?? null,
      vesselId: quote.requisition.vesselId,
      vendorId: params.vendorId,
      requestType: params.requestType,
      message: params.message.trim(),
      vesselVisibleMessage,
      status: "OPEN",
    },
    include: clarificationInclude,
  });

  if (params.files?.length) {
    for (const file of params.files) {
      if (file.size > 0) {
        await uploadClarificationAttachment({
          clarificationRequestId: clarification.id,
          requisitionId: quote.requisitionId,
          vesselId: quote.requisition.vesselId,
          role: "REQUEST_SUPPORTING",
          uploadedByType: "VENDOR",
          uploadedById: params.vendorId,
          file,
        });
      }
    }
  }

  const item = params.requisitionItemId
    ? await prisma.requisitionItem.findUnique({
        where: { id: params.requisitionItemId },
        select: { itemName: true },
      })
    : null;

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    select: { name: true },
  });

  const creatorAccessLevel =
    quote.requisition.createdBy?.designationAccessLevel ??
    (await getRequisitionCreatorAccessLevel(prisma, quote.requisitionId)) ??
    25;

  await notifyClarificationCreated({
    clarificationId: clarification.id,
    requisitionId: quote.requisitionId,
    requisitionNumber: quote.requisition.requisitionNumber,
    vesselId: quote.requisition.vesselId,
    vesselName: quote.requisition.vessel.name,
    itemName: item?.itemName,
    vesselVisibleMessage,
    vendorName: vendor?.name || "Vendor",
    purchaserUserIds: [quote.requisition.createdById],
    creatorAccessLevel,
  });

  await writePlatformAuditEvent(
    {
      actorVendorId: params.vendorId,
      actorRole: "VENDOR",
      vesselId: quote.requisition.vesselId,
      companyId: quote.requisition.vessel.companyId,
      module: "Purchase",
      screen: "Vendor RFQ",
      entityType: "RfqClarification",
      entityId: clarification.id,
      action: "CLARIFICATION_REQUESTED",
      newValue: { requestType: params.requestType, status: "OPEN" },
      metadata: { vendorQuoteId: quote.id, requisitionId: quote.requisitionId },
    },
    params.request
  );

  return getClarificationById(clarification.id);
}

export async function respondToClarification(params: {
  clarificationId: string;
  employeeId: string;
  accessLevel: number;
  responseText: string;
  files?: File[];
  request?: NextRequest;
}) {
  const clarification = await prisma.rfqClarificationRequest.findUnique({
    where: { id: params.clarificationId },
    include: {
      vessel: { select: { name: true } },
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          vesselId: true,
          createdById: true,
          createdBy: { select: { designationAccessLevel: true } },
        },
      },
    },
  });

  if (!clarification) throw new Error("Clarification not found");
  if (clarification.status !== "OPEN") {
    throw new Error("Clarification is not open for response");
  }

  const creatorAccessLevel =
    clarification.requisition.createdBy?.designationAccessLevel ??
    (await getRequisitionCreatorAccessLevel(prisma, clarification.requisitionId));

  if (
    creatorAccessLevel == null ||
    !canEmployeeRespondToClarification(params.accessLevel, creatorAccessLevel)
  ) {
    throw new Error(
      "You are not assigned to respond to this clarification. Another officer rank on board will answer this request."
    );
  }

  const updated = await prisma.rfqClarificationRequest.update({
    where: { id: params.clarificationId },
    data: {
      responseText: params.responseText.trim(),
      answeredAt: new Date(),
      answeredById: params.employeeId,
      status: "ANSWERED",
    },
  });

  if (params.files?.length) {
    for (const file of params.files) {
      if (file.size > 0) {
        await uploadClarificationAttachment({
          clarificationRequestId: updated.id,
          requisitionId: clarification.requisitionId,
          vesselId: clarification.vesselId,
          role: "VESSEL_RESPONSE",
          uploadedByType: "VESSEL",
          uploadedById: params.employeeId,
          file,
        });
      }
    }
  }

  await notifyClarificationAnswered({
    clarificationId: updated.id,
    requisitionId: clarification.requisitionId,
    requisitionNumber: clarification.requisition.requisitionNumber,
    vesselName: clarification.vessel.name,
    vendorQuoteId: clarification.vendorQuoteId,
    vendorId: clarification.vendorId,
    purchaserUserIds: [clarification.requisition.createdById],
  });

  await dismissClarificationTaskNotifications(prisma, updated.id);

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      actorRole: String(params.accessLevel),
      vesselId: clarification.vesselId,
      module: "Purchase",
      screen: "RFQ Clarification",
      entityType: "RfqClarification",
      entityId: updated.id,
      action: "CLARIFICATION_ANSWERED",
      oldValue: { status: "OPEN" },
      newValue: { status: "ANSWERED", responderAccessLevel: params.accessLevel },
      metadata: {
        responderAccessLevel: params.accessLevel,
        creatorAccessLevel,
        respondedAsVessel: true,
      },
    },
    params.request
  );

  return getClarificationById(updated.id);
}

export async function rejectClarification(params: {
  clarificationId: string;
  employeeId: string;
  accessLevel: number;
  reason?: string;
  request?: NextRequest;
}) {
  const clarification = await prisma.rfqClarificationRequest.findUnique({
    where: { id: params.clarificationId },
  });
  if (!clarification) throw new Error("Clarification not found");
  if (clarification.status !== "OPEN") throw new Error("Only open clarifications can be rejected");

  const updated = await prisma.rfqClarificationRequest.update({
    where: { id: params.clarificationId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedById: params.employeeId,
      rejectionReason: params.reason?.trim() || "Rejected by purchaser",
    },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      actorRole: String(params.accessLevel),
      vesselId: clarification.vesselId,
      module: "Purchase",
      entityType: "RfqClarification",
      entityId: updated.id,
      action: "CLARIFICATION_REJECTED",
      newValue: { status: "REJECTED", reason: params.reason },
    },
    params.request
  );

  return getClarificationById(updated.id);
}

export async function closeClarification(params: {
  clarificationId: string;
  employeeId: string;
  accessLevel: number;
  request?: NextRequest;
}) {
  const clarification = await prisma.rfqClarificationRequest.findUnique({
    where: { id: params.clarificationId },
  });
  if (!clarification) throw new Error("Clarification not found");
  if (!["ANSWERED", "OPEN"].includes(clarification.status)) {
    throw new Error("Clarification cannot be closed");
  }

  const updated = await prisma.rfqClarificationRequest.update({
    where: { id: params.clarificationId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: params.employeeId,
    },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      actorRole: String(params.accessLevel),
      vesselId: clarification.vesselId,
      module: "Purchase",
      entityType: "RfqClarification",
      entityId: updated.id,
      action: "CLARIFICATION_CLOSED",
      newValue: { status: "CLOSED" },
    },
    params.request
  );

  return getClarificationById(updated.id);
}
