import { prisma } from "@/lib/prisma";
import type { PurchaseAccessContext } from "@/lib/auth/purchaseAccess";
import { vesselScopeWhere } from "@/lib/auth/purchaseAccess";
import type { PurchaseReqStatus, PurchaseReqType } from "@prisma/client";
import {
  EMPTY_PURCHASE_DASHBOARD_STATS,
  type PurchaseDashboardStats,
  type PurchaseInvoiceListRow,
  type PurchaseOrderListRow,
  type PurchaseRequisitionListRow,
  type PurchaseVendorListRow,
} from "@/lib/purchase/types";

export type {
  PurchaseDashboardStats,
  PurchaseInvoiceListRow,
  PurchaseOrderListRow,
  PurchaseRequisitionListRow,
  PurchaseVendorListRow,
} from "@/lib/purchase/types";
export { EMPTY_PURCHASE_DASHBOARD_STATS } from "@/lib/purchase/types";

const REQ_TYPES = new Set<string>([
  "STR",
  "SPR",
  "GLY",
  "PNT",
  "REP",
  "SER",
  "CTM",
  "PRO",
  "BNK",
  "LUB",
  "FCL",
  "OTR",
  "CHE",
]);

export async function getPurchaseDashboardStats(
  ctx: PurchaseAccessContext,
  vesselId?: string | null,
): Promise<PurchaseDashboardStats | { error: string; status: number }> {
  const scope = vesselScopeWhere(ctx, vesselId);
  if (scope === null) {
    if (!vesselId && !ctx.canSeeAllVessels && ctx.assignedVesselIds.length === 0) {
      return EMPTY_PURCHASE_DASHBOARD_STATS;
    }
    return { error: "Access denied to this vessel.", status: 403 };
  }

  const requisitionWhere = { deletedAt: null, ...scope };
  const poWhere = { deletedAt: null, ...scope };
  const quoteWhere = {
    deletedAt: null,
    requisition: { deletedAt: null, ...scope },
  };
  const invoiceWhere = {
    deletedAt: null,
    requisition: { deletedAt: null, ...scope },
  };

  const [
    totalRequisitions,
    pendingRequisitions,
    approvedRequisitions,
    totalQuotes,
    totalPurchaseOrders,
    totalInvoices,
    totalAmountResult,
    pendingAmountResult,
  ] = await Promise.all([
    prisma.purchaseRequisition.count({ where: requisitionWhere }),
    prisma.purchaseRequisition.count({
      where: { ...requisitionWhere, status: "NOT_READY" },
    }),
    prisma.purchaseRequisition.count({
      where: { ...requisitionWhere, status: "REQ_APPROVED" },
    }),
    prisma.purchaseQuote.count({ where: quoteWhere }),
    prisma.purchaseOrder.count({ where: poWhere }),
    prisma.purchaseInvoice.count({ where: invoiceWhere }),
    prisma.purchaseOrder.aggregate({
      where: poWhere,
      _sum: { totalAmount: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { ...invoiceWhere, status: { not: "PAID" } },
      _sum: { invoiceAmount: true },
    }),
  ]);

  return {
    totalRequisitions,
    pendingRequisitions,
    approvedRequisitions,
    totalQuotes,
    totalPurchaseOrders,
    totalInvoices,
    totalAmount: totalAmountResult._sum.totalAmount ?? 0,
    pendingAmount: pendingAmountResult._sum.invoiceAmount ?? 0,
  };
}

export async function listPurchaseRequisitions(
  ctx: PurchaseAccessContext,
  opts: {
    vesselId?: string | null;
    status?: string | null;
    search?: string | null;
    take?: number;
    skip?: number;
  } = {},
): Promise<{ rows: PurchaseRequisitionListRow[]; total: number } | { error: string; status: number }> {
  const scope = vesselScopeWhere(ctx, opts.vesselId);
  if (scope === null) {
    if (!opts.vesselId && !ctx.canSeeAllVessels && ctx.assignedVesselIds.length === 0) {
      return { rows: [], total: 0 };
    }
    return { error: "Access denied to this vessel.", status: 403 };
  }

  const where = {
    deletedAt: null,
    ...scope,
    ...(opts.status ? { status: opts.status as PurchaseReqStatus } : {}),
    ...(opts.search?.trim()
      ? {
          OR: [
            { requisitionNumber: { contains: opts.search.trim(), mode: "insensitive" as const } },
            { heading: { contains: opts.search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const take = Math.min(opts.take ?? 50, 100);
  const skip = opts.skip ?? 0;

  const [total, rows] = await Promise.all([
    prisma.purchaseRequisition.count({ where }),
    prisma.purchaseRequisition.findMany({
      where,
      include: {
        vessel: { select: { id: true, name: true, code: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      requisitionNumber: r.requisitionNumber,
      heading: r.heading,
      vesselId: r.vesselId,
      vesselName: r.vessel.name,
      vesselCode: r.vessel.code,
      requisitionType: r.requisitionType,
      status: r.status,
      generationStatus: r.generationStatus,
      priority: r.priority,
      createdByName: `${r.createdBy.firstName} ${r.createdBy.lastName}`.trim(),
      createdAt: r.createdAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
      itemCount: r._count.items,
    })),
  };
}

export async function listPurchaseVesselsForUser(ctx: PurchaseAccessContext) {
  const where = ctx.canSeeAllVessels
    ? { deletedAt: null, status: "active" as const }
    : { deletedAt: null, status: "active" as const, id: { in: ctx.assignedVesselIds } };

  if (!ctx.canSeeAllVessels && ctx.assignedVesselIds.length === 0) {
    return [];
  }

  return prisma.vessel.findMany({
    where,
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

export type CreatePurchaseRequisitionInput = {
  vesselId: string;
  heading: string;
  description?: string | null;
  requisitionType: string;
  portOfSupply?: string | null;
  portAgentDetails?: string | null;
  manualReqNumber?: string | null;
  requisitionPurpose?: string | null;
  priority?: string | null;
  subCategoryCode?: string | null;
  budgetCode?: string | null;
  storeLocationId?: string | null;
  machineryAssetId?: string | null;
  spareManualMachineryName?: string | null;
  asDraft?: boolean;
  items?: Array<{
    itemName: string;
    quantity?: number;
    unit?: string;
    description?: string | null;
    partNumber?: string | null;
    remarks?: string | null;
    machineryAssetId?: string | null;
  }>;
};

async function nextRequisitionNumber(vesselCode: string, type: string): Promise<string> {
  const code = vesselCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "GEN";
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `0.${code}.${type}.${yy}.`;
  const latest = await prisma.purchaseRequisition.findFirst({
    where: { requisitionNumber: { startsWith: prefix } },
    orderBy: { requisitionNumber: "desc" },
    select: { requisitionNumber: true },
  });
  let seq = 1;
  if (latest?.requisitionNumber) {
    const tail = latest.requisitionNumber.split(".").pop();
    const n = Number(tail);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createPurchaseRequisition(
  ctx: PurchaseAccessContext,
  input: CreatePurchaseRequisitionInput,
): Promise<
  | { id: string; requisitionNumber: string; items: Array<{ id: string; sortOrder: number }> }
  | { error: string; status: number }
> {
  if (!ctx.employeeId) {
    return {
      error: "Your user is not linked to an employee record. Cannot create requisitions.",
      status: 400,
    };
  }

  const heading = input.heading?.trim();
  if (!heading) return { error: "Heading is required.", status: 400 };
  if (!input.vesselId) return { error: "Vessel is required.", status: 400 };

  const scope = vesselScopeWhere(ctx, input.vesselId);
  if (scope === null) return { error: "Access denied to this vessel.", status: 403 };

  if (!REQ_TYPES.has(input.requisitionType)) {
    return { error: "Invalid requisition type.", status: 400 };
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: input.vesselId, deletedAt: null },
    select: { id: true, code: true },
  });
  if (!vessel) return { error: "Vessel not found.", status: 404 };

  const asDraft = Boolean(input.asDraft);
  const items = (input.items ?? []).filter((i) => i.itemName?.trim());
  if (!asDraft && items.length === 0) {
    return { error: "At least one line item is required to submit.", status: 400 };
  }

  const priority = input.priority?.trim() || "NORMAL";
  if (!["NORMAL", "URGENT", "CRITICAL"].includes(priority)) {
    return { error: "Invalid urgency.", status: 400 };
  }

  let storeLocationId: string | null = null;
  if (input.storeLocationId?.trim()) {
    const store = await prisma.purchaseStoreLocation.findFirst({
      where: {
        id: input.storeLocationId.trim(),
        vesselId: vessel.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!store) return { error: "Store location not found for this vessel.", status: 400 };
    storeLocationId = store.id;
  }

  let machineryAssetId: string | null = null;
  if (input.machineryAssetId?.trim()) {
    const asset = await prisma.vesselMachineryAsset.findFirst({
      where: {
        id: input.machineryAssetId.trim(),
        vesselId: vessel.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!asset) return { error: "Machinery asset not found for this vessel.", status: 400 };
    machineryAssetId = asset.id;
  }

  const requisitionNumber = await nextRequisitionNumber(vessel.code, input.requisitionType);

  const created = await prisma.purchaseRequisition.create({
    data: {
      requisitionNumber,
      manualReqNumber: input.manualReqNumber?.trim() || null,
      heading,
      description: input.description?.trim() || null,
      portOfSupply: input.portOfSupply?.trim() || null,
      portAgentDetails: input.portAgentDetails?.trim() || null,
      requisitionType: input.requisitionType as PurchaseReqType,
      generationStatus: asDraft ? "SAVED_AS_DRAFT" : "CREATED",
      status: asDraft ? "NOT_READY" : "NEW_REQ",
      priority,
      requisitionPurpose: input.requisitionPurpose?.trim() || "ROUTINE_MAINTENANCE",
      subCategoryCode: input.subCategoryCode?.trim() || null,
      budgetCode: input.budgetCode?.trim() || null,
      storeLocationId,
      machineryAssetId,
      spareManualMachineryName: input.spareManualMachineryName?.trim() || null,
      vesselId: vessel.id,
      createdById: ctx.employeeId,
      items: items.length
        ? {
            create: items.map((item, index) => ({
              itemName: item.itemName.trim(),
              quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
              unit: item.unit?.trim() || "pcs",
              description: item.description?.trim() || null,
              partNumber: item.partNumber?.trim() || null,
              remarks: item.remarks?.trim() || null,
              machineryAssetId: item.machineryAssetId?.trim() || machineryAssetId,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      requisitionNumber: true,
      items: { select: { id: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  return created;
}

export async function searchPurchaseImpaCodes(opts: {
  q?: string | null;
  limit?: number;
  scope?: "provision" | "chemical" | null;
}): Promise<Array<{ id: string; impaCode: string; itemName: string; unit: string | null }>> {
  const q = opts.q?.trim() ?? "";
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const scope = opts.scope ?? null;

  if (!scope && q.length < 2) return [];
  if (scope && q.length === 1) return [];

  const rows = await prisma.purchaseImpaCode.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(q
        ? {
            OR: [
              { impaCode: { contains: q, mode: "insensitive" } },
              { itemName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ impaCode: "asc" }],
    take: limit * 3,
    select: { id: true, impaCode: true, itemName: true, unit: true },
  });

  const filtered = rows.filter((row) => {
    if (!scope) return true;
    const digits = row.impaCode.replace(/\D/g, "");
    const n = digits ? Number.parseInt(digits, 10) : NaN;
    if (!Number.isFinite(n)) return false;
    if (scope === "chemical") return n >= 550_000 && n <= 559_999;
    // provision / welfare band (000101–101939)
    return n >= 101 && n <= 101_939;
  });

  return filtered.slice(0, limit);
}

export async function listPurchaseStoreLocations(
  ctx: PurchaseAccessContext,
  vesselId: string,
): Promise<
  | Array<{ id: string; name: string; code: string }>
  | { error: string; status: number }
> {
  const scope = vesselScopeWhere(ctx, vesselId);
  if (scope === null) return { error: "Access denied to this vessel.", status: 403 };

  return prisma.purchaseStoreLocation.findMany({
    where: { vesselId, isActive: true, deletedAt: null },
    orderBy: [{ code: "asc" }],
    select: { id: true, name: true, code: true },
  });
}

export async function listPurchaseMachineryForVessel(
  ctx: PurchaseAccessContext,
  vesselId: string,
  limit = 1000,
): Promise<
  | Array<{
      id: string;
      name: string;
      code: string | null;
      make: string | null;
      model: string | null;
      serialNumber: string | null;
      vesselName: string | null;
      machineryType: string | null;
    }>
  | { error: string; status: number }
> {
  const scope = vesselScopeWhere(ctx, vesselId);
  if (scope === null) return { error: "Access denied to this vessel.", status: 403 };

  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!vessel) return { error: "Vessel not found.", status: 404 };

  const assets = await prisma.vesselMachineryAsset.findMany({
    where: { vesselId, deletedAt: null },
    orderBy: [{ department: "asc" }, { name: "asc" }],
    take: Math.min(limit, 1000),
    select: {
      id: true,
      name: true,
      maker: true,
      model: true,
      serialNumber: true,
      department: true,
    },
  });

  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.department || null,
    make: a.maker,
    model: a.model,
    serialNumber: a.serialNumber,
    vesselName: vessel.name,
    machineryType: a.department,
  }));
}

export async function uploadPurchaseItemAttachment(
  ctx: PurchaseAccessContext,
  input: {
    requisitionId: string;
    itemId: string;
    file: File;
  },
): Promise<
  | { id: string; fileName: string; mimeType: string | null; fileSize: number; fileUrl: string }
  | { error: string; status: number }
> {
  const item = await prisma.purchaseRequisitionItem.findFirst({
    where: {
      id: input.itemId,
      requisitionId: input.requisitionId,
      deletedAt: null,
      requisition: { deletedAt: null },
    },
    select: {
      id: true,
      requisition: { select: { id: true, vesselId: true } },
    },
  });
  if (!item) return { error: "Requisition item not found.", status: 404 };

  const scope = vesselScopeWhere(ctx, item.requisition.vesselId);
  if (scope === null) return { error: "Access denied to this vessel.", status: 403 };

  const allowed = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
  const mime = input.file.type || "application/octet-stream";
  if (!allowed.has(mime)) {
    return { error: "Only PDF, JPEG, and PNG attachments are allowed.", status: 400 };
  }
  if (input.file.size > 10 * 1024 * 1024) {
    return { error: "Attachment must be 10 MB or smaller.", status: 400 };
  }

  const { saveLocalUpload } = await import("@/lib/storage/localUpload");
  const saved = await saveLocalUpload({
    file: input.file,
    segments: ["purchase", "requisitions", input.requisitionId, input.itemId],
  });

  const row = await prisma.purchaseRequisitionItemAttachment.create({
    data: {
      requisitionItemId: item.id,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      fileUrl: saved.fileUrl,
      uploadedById: ctx.employeeId,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      fileUrl: true,
    },
  });

  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize ?? saved.fileSize,
    fileUrl: row.fileUrl,
  };
}

export async function listPurchaseVendors(opts: {
  q?: string | null;
  take?: number;
  skip?: number;
} = {}): Promise<{ rows: PurchaseVendorListRow[]; total: number }> {
  const search = opts.q?.trim();
  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { vendorCode: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
            { primaryEmail: { contains: search, mode: "insensitive" as const } },
            { country: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const take = Math.min(opts.take ?? 50, 100);
  const skip = opts.skip ?? 0;

  const [total, rows] = await Promise.all([
    prisma.purchaseVendor.count({ where }),
    prisma.purchaseVendor.findMany({
      where,
      orderBy: { name: "asc" },
      take,
      skip,
      select: {
        id: true,
        vendorCode: true,
        name: true,
        primaryEmail: true,
        country: true,
        city: true,
        isActive: true,
        isBlacklisted: true,
        verificationStatus: true,
        preferredCurrency: true,
        serviceTypes: true,
      },
    }),
  ]);

  return { total, rows };
}

export async function listPurchaseOrders(
  ctx: PurchaseAccessContext,
  opts: { vesselId?: string | null; take?: number; skip?: number } = {},
): Promise<{ rows: PurchaseOrderListRow[]; total: number } | { error: string; status: number }> {
  const scope = vesselScopeWhere(ctx, opts.vesselId);
  if (scope === null) {
    if (!opts.vesselId && !ctx.canSeeAllVessels && ctx.assignedVesselIds.length === 0) {
      return { rows: [], total: 0 };
    }
    return { error: "Access denied to this vessel.", status: 403 };
  }

  const where = { deletedAt: null, ...scope };
  const take = Math.min(opts.take ?? 50, 100);
  const skip = opts.skip ?? 0;

  const [total, rows] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: {
        requisition: { select: { requisitionNumber: true } },
      },
      orderBy: { dateOfIssue: "desc" },
      take,
      skip,
    }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      poNumber: r.poNumber,
      vesselId: r.vesselId,
      vesselName: r.vesselName,
      status: r.status,
      completionStatus: r.completionStatus,
      totalAmount: r.totalAmount,
      currency: r.currency,
      dateOfIssue: r.dateOfIssue.toISOString(),
      requisitionNumber: r.requisition.requisitionNumber,
    })),
  };
}

export async function listPurchaseInvoices(
  ctx: PurchaseAccessContext,
  opts: { vesselId?: string | null; take?: number; skip?: number } = {},
): Promise<{ rows: PurchaseInvoiceListRow[]; total: number } | { error: string; status: number }> {
  const scope = vesselScopeWhere(ctx, opts.vesselId);
  if (scope === null) {
    if (!opts.vesselId && !ctx.canSeeAllVessels && ctx.assignedVesselIds.length === 0) {
      return { rows: [], total: 0 };
    }
    return { error: "Access denied to this vessel.", status: 403 };
  }

  const where = {
    deletedAt: null,
    requisition: { deletedAt: null, ...scope },
  };
  const take = Math.min(opts.take ?? 50, 100);
  const skip = opts.skip ?? 0;

  const [total, rows] = await Promise.all([
    prisma.purchaseInvoice.count({ where }),
    prisma.purchaseInvoice.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        requisition: { select: { requisitionNumber: true } },
        purchaseOrder: { select: { poNumber: true } },
      },
      orderBy: { invoiceDate: "desc" },
      take,
      skip,
    }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      vendorName: r.vendor.name,
      invoiceAmount: r.invoiceAmount,
      currency: r.currency,
      status: r.status,
      invoiceDate: r.invoiceDate.toISOString(),
      requisitionNumber: r.requisition.requisitionNumber,
      poNumber: r.purchaseOrder?.poNumber ?? null,
    })),
  };
}
