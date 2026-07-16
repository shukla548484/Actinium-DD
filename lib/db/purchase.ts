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
  asDraft?: boolean;
  items?: Array<{
    itemName: string;
    quantity?: number;
    unit?: string;
    description?: string | null;
    partNumber?: string | null;
  }>;
};

async function nextRequisitionNumber(vesselCode: string): Promise<string> {
  const prefix = `PR-${vesselCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "GEN"}`;
  const latest = await prisma.purchaseRequisition.findFirst({
    where: { requisitionNumber: { startsWith: prefix } },
    orderBy: { requisitionNumber: "desc" },
    select: { requisitionNumber: true },
  });
  let seq = 1;
  if (latest?.requisitionNumber) {
    const tail = latest.requisitionNumber.split("-").pop();
    const n = Number(tail);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export async function createPurchaseRequisition(
  ctx: PurchaseAccessContext,
  input: CreatePurchaseRequisitionInput,
): Promise<
  | { id: string; requisitionNumber: string }
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

  const requisitionNumber = await nextRequisitionNumber(vessel.code);

  const created = await prisma.purchaseRequisition.create({
    data: {
      requisitionNumber,
      heading,
      description: input.description?.trim() || null,
      portOfSupply: input.portOfSupply?.trim() || null,
      requisitionType: input.requisitionType as PurchaseReqType,
      generationStatus: asDraft ? "SAVED_AS_DRAFT" : "CREATED",
      status: asDraft ? "NOT_READY" : "NEW_REQ",
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
              sortOrder: index,
            })),
          }
        : undefined,
    },
    select: { id: true, requisitionNumber: true },
  });

  return created;
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
