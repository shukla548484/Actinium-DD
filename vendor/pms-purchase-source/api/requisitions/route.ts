import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  computeRequisitionQuoteStats,
} from "@/lib/procurement/vendor-quote-receipt";
import {
  reconcileRequisitionStatus,
  toRequisitionReconcileInput,
} from "@/lib/procurement/requisition-status-reconcile";
import { resolveRequisitionBudgetCode } from "@/lib/purchase-budget-resolve";
import {
  appendRequisitionAccessLevelFilter,
  resolveRequisitionViewer,
} from "@/lib/requisition-list-access";
import { 
  RequisitionType, 
  GenerationStatus, 
  RequisitionStatus,
  generateRequisitionNumberForOrigin,
  canCreateRequisition,
  canOfficeCreateRequisition,
  canViewRequisition,
  initialStatusForNewRequisition,
  CREW_REQUISITION_CREATOR_MIN_ACCESS,
  CREW_REQUISITION_CREATOR_MAX_ACCESS,
  OFFICE_REQUISITION_CREATOR_MIN_ACCESS,
} from "@/lib/types/requisition";
import {
  ensureRequisitionNumberOrigin,
  requisitionNumberPrefix,
} from "@/lib/sync/record-origin-suffix";
import {
  authenticateVesselLocalSyncUser,
  isVesselLocalSyncRequest,
  recordOriginForRequest,
} from "@/lib/sync/vessel-local-push";
import {
  isValidSyncUuid,
  readSyncRowId,
  resolveSyncRowIdentity,
  syncIdForRecordOrigin,
} from "@/lib/sync/sync-row-identity";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { notifyRequisitionApprovalPending } from "@/lib/procurement/approval-notifications";
import { Prisma, RequisitionType as PrismaRequisitionType } from "@prisma/client";
import {
  CTM_SUB_CATEGORY_CODE,
  getRequisitionSubCategoryNameMap,
  resolveRequisitionDepartmentName,
} from "@/lib/requisition-subcategory-lookup";

export const dynamic = "force-dynamic";

type PurchaseRequisitionListSummaryRow = {
  requisitionId: string;
  vendorQuotes: unknown;
  quoteStats: unknown;
  purchaseOrders: unknown;
  purchaseOrderCount: number | bigint | null;
  activePurchaseOrderCount: number | bigint | null;
  itemPriority: string | null;
};

type PurchaseRequisitionListSummary = {
  vendorQuotes: any[];
  quoteStats?: {
    totalQuotesSent: number;
    receivedQuotes: number;
    declinedQuotes: number;
  };
  purchaseOrders: any[];
  purchaseOrderCount: number;
  activePurchaseOrderCount: number;
  itemPriority: string;
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: number | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asQuoteStats(value: unknown): PurchaseRequisitionListSummary["quoteStats"] {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    totalQuotesSent: asNumber(record.totalQuotesSent as number | bigint | null | undefined),
    receivedQuotes: asNumber(record.receivedQuotes as number | bigint | null | undefined),
    declinedQuotes: asNumber(record.declinedQuotes as number | bigint | null | undefined),
  };
}

async function loadPurchaseRequisitionListSummaries(
  requisitionIds: string[]
): Promise<Map<string, PurchaseRequisitionListSummary> | null> {
  if (requisitionIds.length === 0) return new Map();

  try {
    const uuidIds = requisitionIds.map((id) => Prisma.sql`${id}::uuid`);
    const rows = await prisma.$queryRaw<PurchaseRequisitionListSummaryRow[]>`
      SELECT
        "requisition_id"::text AS "requisitionId",
        "vendor_quotes_json" AS "vendorQuotes",
        "quote_stats_json" AS "quoteStats",
        "purchase_orders_json" AS "purchaseOrders",
        "purchase_order_count" AS "purchaseOrderCount",
        "active_purchase_order_count" AS "activePurchaseOrderCount",
        "item_priority" AS "itemPriority"
      FROM "purchase_requisition_list_summary"
      WHERE "requisition_id" IN (${Prisma.join(uuidIds)})
    `;

    const summaries = new Map<string, PurchaseRequisitionListSummary>();
    for (const row of rows) {
      summaries.set(row.requisitionId, {
        vendorQuotes: asArray(row.vendorQuotes),
        quoteStats: asQuoteStats(row.quoteStats),
        purchaseOrders: asArray(row.purchaseOrders),
        purchaseOrderCount: asNumber(row.purchaseOrderCount),
        activePurchaseOrderCount: asNumber(row.activePurchaseOrderCount),
        itemPriority: row.itemPriority || "NORMAL",
      });
    }
    return summaries;
  } catch (error) {
    // Summary table is created by migration. Until every environment has applied it,
    // keep the live relation-summary path as a safe compatibility fallback.
    console.warn("[requisitions] summary table unavailable; using live summary fallback", error);
    return null;
  }
}

// GET /api/requisitions - List requisitions with pagination and filters
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const rawLimit = parseInt(searchParams.get("limit") || "30", 10) || 30;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const search = searchParams.get("search") || "";
    const requisitionNumber = searchParams.get("requisitionNumber") || "";
    const heading = searchParams.get("heading") || "";
    const requisitionType = searchParams.get("requisitionType") as RequisitionType;
    const generationStatus = searchParams.get("generationStatus") as GenerationStatus;
    const status = searchParams.get("status") as RequisitionStatus;
    const vesselId = searchParams.get("vesselId") || "";
    const createdById = searchParams.get("createdById") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const draftsOnly = searchParams.get("draftsOnly") === "true";
    const hasDeclinedSuppliers = searchParams.get("hasDeclinedSuppliers") === "true";
    const priority = searchParams.get("priority") || "";
    const reasonForRequisition = searchParams.get("reasonForRequisition") || "";
    const poIssued = searchParams.get("poIssued") || "";
    const includeAllItems = searchParams.get("includeAllItems") === "true";

    const { viewerId, viewerAccessLevel } = await resolveRequisitionViewer(
      request,
      searchParams.get("viewerId")
    );

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    appendRequisitionAccessLevelFilter(where, { viewerId, viewerAccessLevel });

    if (search) {
      where.OR = [
        { requisitionNumber: { contains: search, mode: "insensitive" } },
        { heading: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { createdBy: { 
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } }
          ]
        }},
        { vessel: { 
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } }
          ]
        }}
      ];
    }

    // Add specific filters for requisition number and heading
    if (requisitionNumber) {
      where.requisitionNumber = { contains: requisitionNumber, mode: "insensitive" };
    }

    if (heading) {
      where.heading = { contains: heading, mode: "insensitive" };
    }

    if (requisitionType) {
      where.requisitionType = requisitionType;
    }

    if (generationStatus) {
      where.generationStatus = generationStatus;
    }

    if (status) {
      where.AND = [...(where.AND || []), { status }];
    }

    if (vesselId) {
      // Handle comma-separated vessel IDs; cap to avoid slow IN clauses
      const vesselIds = vesselId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (vesselIds.length === 1) {
        where.vesselId = vesselIds[0];
      } else if (vesselIds.length > 1) {
        where.vesselId = { in: vesselIds };
      }
    }

    if (createdById) {
      where.createdById = createdById;
    }

    if (draftsOnly) {
      // Only show drafts that are still editable (not converted to "New Requisition")
      where.generationStatus = GenerationStatus.SAVED_AS_DRAFT;
      // Exclude requisitions with status NEW_REQ (New Requisition) - these are no longer editable drafts
      where.status = {
        not: RequisitionStatus.NEW_REQ
      };
      // Only show requisitions that are marked as editable
      where.isEditable = true;
    }

    if (dateFrom || dateTo) {
      where.dateOfCreation = {};
      if (dateFrom) {
        where.dateOfCreation.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.dateOfCreation.lte = new Date(dateTo);
      }
    }

    // Filter by declined suppliers if requested
    if (hasDeclinedSuppliers) {
      where.vendorQuotes = {
        some: {
          status: {
            in: ['REJECTED', 'DECLINED'],
          },
        },
      };
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by reason for requisition
    if (reasonForRequisition) {
      where.reasonForRequisition = reasonForRequisition;
    }

    // Filter by whether PO has been issued (sent to vendor)
    if (poIssued === "yes") {
      where.AND = [
        ...(where.AND || []),
        { status: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT },
      ];
    } else if (poIssued === "no") {
      where.AND = [
        ...(where.AND || []),
        { status: { not: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT } },
      ];
    }

    const [total, requisitions] = await Promise.all([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          items: {
            orderBy: {
              createdAt: 'asc',
            },
            take: includeAllItems ? undefined : 1,
          },
          parentRequisition: {
            select: { id: true, requisitionNumber: true },
          },
          childRequisitions: {
            select: {
              id: true,
              requisitionNumber: true,
              status: true,
              heading: true,
              requisitionType: true,
              dateOfCreation: true,
              parentRequisitionId: true,
              splitIndex: true,
            },
            orderBy: { splitIndex: 'asc' },
          },
          reorderAlerts: {
            select: {
              id: true,
              status: true,
              sparePart: {
                select: {
                  id: true,
                  name: true,
                  sparePartNumber: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const requisitionIds = requisitions.map((req) => req.id);

    const summariesByRequisition =
      await loadPurchaseRequisitionListSummaries(requisitionIds);

    const quotesByRequisition = new Map<string, any[]>();
    const purchaseOrdersByRequisition = new Map<string, any[]>();
    const purchaseOrderCountByRequisition = new Map<string, number>();
    const activePurchaseOrderCountByRequisition = new Map<string, number>();
    const itemPriorityByRequisition = new Map<string, string>();
    const quoteStatsByRequisition = new Map<
      string,
      NonNullable<PurchaseRequisitionListSummary["quoteStats"]>
    >();

    if (summariesByRequisition) {
      for (const [requisitionId, summary] of summariesByRequisition) {
        quotesByRequisition.set(requisitionId, summary.vendorQuotes);
        purchaseOrdersByRequisition.set(requisitionId, summary.purchaseOrders);
        purchaseOrderCountByRequisition.set(requisitionId, summary.purchaseOrderCount);
        activePurchaseOrderCountByRequisition.set(
          requisitionId,
          summary.activePurchaseOrderCount
        );
        itemPriorityByRequisition.set(requisitionId, summary.itemPriority);
        if (summary.quoteStats) {
          quoteStatsByRequisition.set(requisitionId, summary.quoteStats);
        }
      }
    } else if (requisitionIds.length > 0) {
      const [vendorQuotes, purchaseOrders, purchaseOrderCounts, activePurchaseOrderCounts] =
        await Promise.all([
          prisma.vendorQuote.findMany({
            where: { requisitionId: { in: requisitionIds } },
            select: {
              id: true,
              requisitionId: true,
              status: true,
              vendorId: true,
              receivedAt: true,
              createdAt: true,
              quotedItems: {
                where: {
                  OR: [
                    { unitPrice: { not: null } },
                    { totalPrice: { not: null } },
                  ],
                },
                select: {
                  unitPrice: true,
                  totalPrice: true,
                },
                take: 1,
              },
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }),
          prisma.purchaseOrder.findMany({
            where: { requisitionId: { in: requisitionIds } },
            select: {
              id: true,
              requisitionId: true,
              poNumber: true,
              status: true,
              dateOfIssue: true,
            },
            orderBy: [{ requisitionId: "asc" }, { dateOfIssue: "desc" }],
          }),
          prisma.purchaseOrder.groupBy({
            by: ["requisitionId"],
            where: { requisitionId: { in: requisitionIds } },
            _count: { _all: true },
          }),
          prisma.purchaseOrder.groupBy({
            by: ["requisitionId"],
            where: {
              requisitionId: { in: requisitionIds },
              status: { not: "CANCELLED" },
            },
            _count: { _all: true },
          }),
        ]);

      for (const quote of vendorQuotes) {
        const current = quotesByRequisition.get(quote.requisitionId) ?? [];
        current.push(quote);
        quotesByRequisition.set(quote.requisitionId, current);
      }

      for (const po of purchaseOrders) {
        const current = purchaseOrdersByRequisition.get(po.requisitionId) ?? [];
        if (current.length < 2) {
          current.push(po);
          purchaseOrdersByRequisition.set(po.requisitionId, current);
        }
      }

      for (const row of purchaseOrderCounts) {
        purchaseOrderCountByRequisition.set(row.requisitionId, row._count._all);
      }
      for (const row of activePurchaseOrderCounts) {
        activePurchaseOrderCountByRequisition.set(row.requisitionId, row._count._all);
      }
    }

    const subCategoryNameMap = await getRequisitionSubCategoryNameMap(
      requisitions.map((req) => req.subCategoryCode)
    );

    // Preserve display-time status reconciliation without mutating rows during a read request.
    for (const req of requisitions) {
      const reconciled = reconcileRequisitionStatus(
        toRequisitionReconcileInput({
          ...req,
          vendorQuotes: quotesByRequisition.get(req.id) ?? [],
          purchaseOrders: purchaseOrdersByRequisition.get(req.id) ?? [],
        })
      );
      if (reconciled) {
        req.status = reconciled.expectedStatus as typeof req.status;
      }
    }

    // Calculate supplier response statistics and priority for each requisition
    const requisitionsWithStats = requisitions.map((req) => {
      const reqVendorQuotes = quotesByRequisition.get(req.id) ?? [];
      const reqPurchaseOrders = purchaseOrdersByRequisition.get(req.id) ?? [];
      const purchaseOrderCount = purchaseOrderCountByRequisition.get(req.id) ?? 0;
      const activePurchaseOrderCount = activePurchaseOrderCountByRequisition.get(req.id) ?? 0;
      const quoteStats =
        quoteStatsByRequisition.get(req.id) ??
        computeRequisitionQuoteStats(reqVendorQuotes);

      // Calculate priority from items if not set
      let calculatedPriority = req.priority;
      if (!calculatedPriority && itemPriorityByRequisition.has(req.id)) {
        calculatedPriority = itemPriorityByRequisition.get(req.id) ?? null;
      } else if (!calculatedPriority && req.items && req.items.length > 0) {
        const urgencies = req.items.map((item: any) => item.urgency);
        if (urgencies.includes('URGENT')) {
          calculatedPriority = 'CRITICAL';
        } else if (urgencies.includes('HIGH')) {
          calculatedPriority = 'HIGH';
        } else if (urgencies.includes('NORMAL')) {
          calculatedPriority = 'NORMAL';
        } else {
          calculatedPriority = 'LOW';
        }
      }

      return {
        ...req,
        vendorQuotes: reqVendorQuotes,
        purchaseOrders: reqPurchaseOrders,
        purchaseOrderCount,
        activePurchaseOrderCount,
        priority: calculatedPriority || 'NORMAL',
        quoteStats,
        subCategoryName: resolveRequisitionDepartmentName(
          req.requisitionType,
          req.subCategoryCode,
          subCategoryNameMap
        ),
      };
    });

    return NextResponse.json(
      {
        requisitions: requisitionsWithStats,
        total,
        page,
        limit,
        totalPages,
      },
      {
        headers: {
          "X-Response-Time-Ms": String(Date.now() - started),
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching requisitions:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch requisitions";
    const errorDetails = process.env.NODE_ENV === 'development' ? {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name,
    } : { message: errorMessage };
    return NextResponse.json(
      { error: errorMessage, ...errorDetails },
      { status: 500 }
    );
  }
}

// POST /api/requisitions - Create new requisition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      heading,
      manualReqNumber,
      description,
      portOfSupply,
      requisitionType,
      requisitionPurpose = "ROUTINE_MAINTENANCE",
      priority = "NORMAL", // Requisition urgency: NORMAL | URGENT | CRITICAL
      portAgentDetails,
      vesselId,
      items,
      generationStatus = GenerationStatus.SAVED_AS_DRAFT,
      createdById, // This would come from session in real app
      contractId, // Contract selection
      budgetCode, // Budget code
      glCode, // GL code
      costCenter, // Cost center
      drawingAttachmentIds, // IDs of drawing attachments (uploaded before requisition create) to link
      subCategoryCode: subCategoryCodeRaw,
      subCategoryCodes: subCategoryCodesRaw,
      storeLocationId: storeLocationIdRaw,
      lubeOilSupplierId: lubeOilSupplierIdRaw,
      id: clientRowId,
      requisitionNumber: clientRequisitionNumberRaw,
    } = body;

    const subCategoryCode =
      subCategoryCodeRaw !== undefined && subCategoryCodeRaw !== null && String(subCategoryCodeRaw).trim() !== ""
        ? String(subCategoryCodeRaw).trim()
        : null;

    const subCategoryCodesList = Array.isArray(subCategoryCodesRaw)
      ? subCategoryCodesRaw.map((c) => String(c).trim()).filter(Boolean)
      : subCategoryCode
        ? [subCategoryCode]
        : [];

    let resolvedSubCategoryCode: string | null =
      subCategoryCodesList[0] ?? subCategoryCode;

    let resolvedLubeOilSupplierId: string | null = null;
    let lubeOilSupplierRecord: { id: string; code: string; name: string } | null = null;

    // Validate required fields
    if (!heading || !requisitionType || !vesselId || !createdById) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Object.values(RequisitionType).includes(requisitionType as RequisitionType)) {
      return NextResponse.json({ error: "Invalid requisition type" }, { status: 400 });
    }

    if (requisitionType === RequisitionType.LUB) {
      const supplierId = String(lubeOilSupplierIdRaw || "").trim();
      if (generationStatus === GenerationStatus.CREATED && !supplierId) {
        return NextResponse.json(
          { error: "Lube oil supplier is required for lube requisitions." },
          { status: 400 }
        );
      }
      if (supplierId) {
        lubeOilSupplierRecord = await prisma.lubeOilSupplier.findFirst({
          where: { id: supplierId, isActive: true },
          select: { id: true, code: true, name: true },
        });
        if (!lubeOilSupplierRecord) {
          return NextResponse.json(
            { error: "Invalid or inactive lube oil supplier." },
            { status: 400 }
          );
        }
        resolvedLubeOilSupplierId = supplierId;
      }
      const mixed = await prisma.requisitionSubCategory.findFirst({
        where: {
          requisitionType: requisitionType as PrismaRequisitionType,
          isActive: true,
          code: { endsWith: "-COM" },
        },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      });
      const fallback =
        mixed ??
        (await prisma.requisitionSubCategory.findFirst({
          where: { requisitionType: requisitionType as PrismaRequisitionType, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        }));
      resolvedSubCategoryCode = fallback?.code ?? null;
      if (!resolvedSubCategoryCode) {
        return NextResponse.json(
          {
            error:
              "No sub-categories are configured for LUB requisitions. Run database migrations or seed requisition_sub_categories.",
          },
          { status: 400 }
        );
      }
    } else if (requisitionType === RequisitionType.CTM) {
      resolvedSubCategoryCode = resolvedSubCategoryCode ?? CTM_SUB_CATEGORY_CODE;
      const subOk = await prisma.requisitionSubCategory.findFirst({
        where: {
          code: resolvedSubCategoryCode,
          requisitionType: RequisitionType.CTM,
          isActive: true,
        },
      });
      if (!subOk) {
        return NextResponse.json(
          {
            error:
              "CTM sub-category is not configured. Run prisma/sql/add-ctm-requisition-subcategory.sql on the master database.",
          },
          { status: 400 }
        );
      }
    } else {
      if (!resolvedSubCategoryCode) {
        const mixed = await prisma.requisitionSubCategory.findFirst({
          where: {
            requisitionType: requisitionType as PrismaRequisitionType,
            isActive: true,
            code: { endsWith: "-COM" },
          },
          orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        });
        const fallback =
          mixed ??
          (await prisma.requisitionSubCategory.findFirst({
            where: { requisitionType: requisitionType as PrismaRequisitionType, isActive: true },
            orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
          }));
        resolvedSubCategoryCode = fallback?.code ?? null;
      }
      if (!resolvedSubCategoryCode) {
        return NextResponse.json(
          {
            error:
              "No sub-categories are configured for this requisition type. Run database migrations or seed requisition_sub_categories.",
            hint:
              requisitionType === RequisitionType.CHE
                ? "Run prisma/sql/add-chemicals-requisition-type.sql on the master database."
                : undefined,
          },
          { status: 400 }
        );
      }
      const subOk = await prisma.requisitionSubCategory.findFirst({
        where: {
          code: resolvedSubCategoryCode,
          requisitionType: requisitionType as PrismaRequisitionType,
          isActive: true,
        },
      });
      if (!subOk) {
        return NextResponse.json(
          { error: "Invalid or inactive sub category for the selected requisition type." },
          { status: 400 }
        );
      }
      if (requisitionType !== RequisitionType.LUB && subCategoryCodesList.length > 0) {
        for (const code of subCategoryCodesList) {
          const ok = await prisma.requisitionSubCategory.findFirst({
            where: {
              code,
              requisitionType: requisitionType as PrismaRequisitionType,
              isActive: true,
            },
          });
          if (!ok) {
            return NextResponse.json(
              { error: `Invalid or inactive sub category: ${code}` },
              { status: 400 }
            );
          }
        }
        resolvedSubCategoryCode = subCategoryCodesList[0];
      }
    }

    // Validate items for non-draft requisitions
    if (generationStatus === GenerationStatus.CREATED && (!items || items.length === 0)) {
      return NextResponse.json(
        { error: "At least one item is required for a new requisition." },
        { status: 400 }
      );
    }

    // Ensure items is an array
    const itemsList = Array.isArray(items) ? items : [];

    if (
      requisitionType === RequisitionType.LUB &&
      generationStatus === GenerationStatus.CREATED &&
      resolvedLubeOilSupplierId
    ) {
      const validProducts = await prisma.lubeOilProduct.findMany({
        where: { supplierId: resolvedLubeOilSupplierId, isActive: true },
        select: { code: true },
      });
      const validCodes = new Set(validProducts.map((p) => p.code.toUpperCase()));
      for (const item of itemsList) {
        const code = String(item.oilGrade || "").trim().toUpperCase();
        if (!code) {
          return NextResponse.json(
            { error: "Each lube line item must have a product selected." },
            { status: 400 }
          );
        }
        if (!validCodes.has(code)) {
          return NextResponse.json(
            { error: `Invalid lube product "${item.oilGrade}" for the selected supplier.` },
            { status: 400 }
          );
        }
      }
    }

    // Get creator's access level from database
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded designation mapping
    // This was previously fixed to use database field - do not revert to getDesignationAccessLevel()
    const creator = await prisma.employee.findUnique({
      where: { id: createdById },
      select: { 
        designationAccessLevel: true,
        designation: true  // Keep for logging/debugging only
      }
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Use designationAccessLevel directly from database
    // DO NOT use getDesignationAccessLevel() - it uses hardcoded mapping and is unreliable
    const accessLevel = creator.designationAccessLevel;
    const vesselSyncUser = await authenticateVesselLocalSyncUser(request, vesselId);
    if (
      !vesselSyncUser &&
      !canCreateRequisition(accessLevel) &&
      !canOfficeCreateRequisition(accessLevel)
    ) {
      console.error(`[Requisition Create] Access denied for employee ${createdById}:`, {
        designation: creator.designation,
        designationAccessLevel: accessLevel,
        requiredLevels: `vessel crew ${CREW_REQUISITION_CREATOR_MIN_ACCESS}-${CREW_REQUISITION_CREATOR_MAX_ACCESS} or office ${OFFICE_REQUISITION_CREATOR_MIN_ACCESS}+`,
      });
      return NextResponse.json(
        { error: "Insufficient access level to create requisitions" },
        { status: 403 }
      );
    }

    // Get vessel for requisition number generation
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { code: true }
    });

    if (!vessel) {
      return NextResponse.json(
        { error: "Vessel not found" },
        { status: 404 }
      );
    }

    let storeLocationId: string | null = null;
    if (storeLocationIdRaw != null && String(storeLocationIdRaw).trim() !== "") {
      if (requisitionType !== RequisitionType.STR) {
        return NextResponse.json(
          { error: "storeLocationId is only valid for STR requisitions" },
          { status: 400 }
        );
      }
      const loc = await prisma.storeLocation.findFirst({
        where: {
          id: String(storeLocationIdRaw).trim(),
          isActive: true,
          location: { vesselId },
        },
      });
      if (!loc) {
        return NextResponse.json(
          { error: "Invalid or inactive store location for this vessel" },
          { status: 400 }
        );
      }
      storeLocationId = loc.id;
    }

    const resolvedBudget = await resolveRequisitionBudgetCode({
      requisitionType,
      requisitionPurpose: requisitionPurpose || null,
      explicitBudgetCode: budgetCode,
      subCategoryCode:
        requisitionType === RequisitionType.LUB ? null : resolvedSubCategoryCode || undefined,
    });
    const finalBudgetCode = resolvedBudget.budgetCode?.trim() || undefined;
    const isBudgeted = finalBudgetCode ? true : null;

    const requisitionDetailsJson =
      requisitionType === RequisitionType.LUB && lubeOilSupplierRecord
        ? JSON.stringify({
            lubeOilSupplierId: lubeOilSupplierRecord.id,
            lubeOilSupplierCode: lubeOilSupplierRecord.code,
            lubeOilSupplierName: lubeOilSupplierRecord.name,
          })
        : undefined;

    // Generate requisition number atomically with retry logic
    const year = new Date().getFullYear();
    const vesselPush = isVesselLocalSyncRequest(request);
    const origin = recordOriginForRequest(request, accessLevel!);
    const prefix = requisitionNumberPrefix(origin);
    const yearSuffix = year.toString().slice(-2);
    const clientRequisitionNumber =
      vesselPush &&
      typeof clientRequisitionNumberRaw === "string" &&
      clientRequisitionNumberRaw.trim()
        ? ensureRequisitionNumberOrigin(clientRequisitionNumberRaw.trim(), "VESSEL")
        : null;

    let requisitionRowId = syncIdForRecordOrigin(origin);
    if (vesselPush && clientRowId) {
      const { row } = resolveSyncRowIdentity("requisitions", { id: clientRowId }, {
        origin: "VESSEL",
        retagUntagged: true,
      });
      const rid = readSyncRowId(row);
      if (rid && isValidSyncUuid(rid)) requisitionRowId = rid;
    }
    
    // Check if user has a reservation for this vessel/type
    const now = new Date();
    const existingReservation = await prisma.requisitionNumberReservation.findFirst({
      where: {
        vesselId,
        requisitionType,
        reservedBy: createdById,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    let reservedNumber: string | null = null;
    if (existingReservation) {
      reservedNumber = existingReservation.requisitionNumber;
      console.log('[Requisition Create] Using reserved number:', reservedNumber);
    }
    
    // Use transaction with retry logic to ensure unique requisition numbers
    let requisition;
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      try {
        requisition = await prisma.$transaction(async (tx) => {
          // If we have a reserved number, use it (but still validate)
          if (reservedNumber) {
            // Verify the reservation is still valid and belongs to this user
            const reservation = await tx.requisitionNumberReservation.findUnique({
              where: { requisitionNumber: reservedNumber },
            });

            if (reservation && reservation.reservedBy === createdById && reservation.expiresAt > now) {
              // Use the reserved number
              const requisitionNumber = clientRequisitionNumber ?? reservedNumber;
              // O.* + CREATED + access ≥ 32 → NEW_REQ (no Master). Drafts and V.* stay NOT_READY as needed.
              const initialStatus = initialStatusForNewRequisition(
                generationStatus,
                prefix,
                accessLevel
              );
              const isEditable =
                initialStatus === RequisitionStatus.NOT_READY &&
                generationStatus === GenerationStatus.SAVED_AS_DRAFT;

              // Create requisition with items
              const created = await tx.requisition.create({
                data: {
                  id: requisitionRowId,
                  requisitionNumber,
                  heading,
                  manualReqNumber,
                  description,
                  portOfSupply,
                  requisitionType,
                  requisitionPurpose: requisitionPurpose || "ROUTINE_MAINTENANCE",
                  priority: priority === "URGENT" || priority === "CRITICAL" ? priority : "NORMAL",
                  generationStatus,
                  status: initialStatus,
                  portAgentDetails,
                  isEditable,
                  createdById,
                  vesselId,
                  contractId: contractId || undefined,
                  budgetCode: finalBudgetCode,
                  isBudgeted,
                  glCode: glCode || undefined,
                  costCenter: costCenter || undefined,
                  subCategoryCode: resolvedSubCategoryCode || undefined,
                  lubeOilSupplierId: resolvedLubeOilSupplierId ?? undefined,
                  storeLocationId: storeLocationId ?? undefined,
                  detailsJson: requisitionDetailsJson ?? "{}",
                  items: {
                    create: itemsList.map((item: any) => ({
                      itemName: item.itemName,
                      description: item.description,
                      quantity: item.quantity,
                      unit: item.unit,
                      urgency: item.urgency,
                      remarks: item.remarks,
                      impaNumber: item.impaCode || item.impaNumber || null,
                      machineryInstanceId:
                        requisitionType === RequisitionType.LUB
                          ? undefined
                          : item.machineryInstanceId && item.machineryInstanceId !== ""
                            ? item.machineryInstanceId
                            : undefined,
                      manualMachineryName: item.manualMachineryName,
                      partNumber: item.partNumber,
                      plateNumber: item.plateNumber?.trim() || null,
                      partName: item.partName,
                      itemNumber: item.itemNumber,
                      drawingNumber: item.drawingNumber,
                      currentRob: item.currentRob ? Number(item.currentRob) : undefined,
                      addToInventory: item.addToInventory !== false,
                      oilGrade: item.oilGrade,
                      paintBrand: item.paintBrand,
                      paintProductName: item.paintProductName,
                      paintColorGrade: item.paintColorGrade,
                      paintColorName: item.paintColorName,
                      paintColorHex: item.paintColorHex,
                      paintType: item.paintType,
                      paintCategory: item.paintCategory,
                    })),
                  },
                },
                include: {
                  createdBy: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      designation: true,
                    },
                  },
                  vessel: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                  items: true,
                },
              });

              if (requisitionType === RequisitionType.SPR) {
                const { upsertMainEnginePlateCatalogFromRequisitionItems } = await import(
                  "@/lib/spares-inventory/main-engine-plate-catalog"
                );
                await upsertMainEnginePlateCatalogFromRequisitionItems(tx, {
                  vesselId,
                  items: itemsList,
                });
              }

              // Delete the reservation after successful creation
              await tx.requisitionNumberReservation.delete({
                where: { requisitionNumber },
              }).catch(() => {
                // Ignore if already deleted
              });

              return created;
            } else {
              // Reservation expired or invalid, continue with normal flow
              console.log('[Requisition Create] Reservation expired or invalid, calculating new number');
            }
          }

          // Normal flow: Get the maximum sequence number for this vessel/type/year combination
          // Using raw SQL to get max sequence within transaction
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year + 1, 0, 1);
          const pattern = `${prefix}.${vessel.code}.${requisitionType}.${yearSuffix}.%`;
          
          // Get max sequence using raw SQL - don't filter by date_of_creation, just by requisition_number pattern
          // This ensures we find all requisitions regardless of when they were created
          console.log('[Requisition Number] Pattern:', pattern);
          console.log('[Requisition Number] Vessel ID:', vesselId);
          console.log('[Requisition Number] Type:', requisitionType);
          
          // Clean up expired reservations first
          await tx.$executeRaw`
            DELETE FROM requisition_number_reservations
            WHERE expires_at < ${now}::timestamptz
          `;

          // Get max sequence from actual requisitions
          const reqResult = await tx.$queryRaw<Array<{ max_sequence: number | null }>>`
            SELECT MAX(
              CAST(
                SPLIT_PART(requisition_number, '.', 5) AS INTEGER
              )
            ) as max_sequence
            FROM requisitions
            WHERE vessel_id = ${vesselId}::uuid
              AND requisition_type = ${requisitionType}::requisition_type
              AND requisition_number LIKE ${pattern}
          `;

          let maxSequenceFromRequisitions = 0;
          if (reqResult && Array.isArray(reqResult) && reqResult.length > 0 && reqResult[0]?.max_sequence !== null) {
            const maxSeq = Number(reqResult[0].max_sequence);
            if (!isNaN(maxSeq) && maxSeq > 0) {
              maxSequenceFromRequisitions = maxSeq;
            }
          }

          // Get max sequence from active reservations
          const reservationResult = await tx.$queryRaw<Array<{ max_sequence: number | null }>>`
            SELECT MAX(
              CAST(
                SPLIT_PART(requisition_number, '.', 5) AS INTEGER
              )
            ) as max_sequence
            FROM requisition_number_reservations
            WHERE vessel_id = ${vesselId}::uuid
              AND requisition_type = ${requisitionType}::requisition_type
              AND requisition_number LIKE ${pattern}
              AND expires_at > ${now}::timestamptz
          `;

          let maxSequenceFromReservations = 0;
          if (reservationResult && Array.isArray(reservationResult) && reservationResult.length > 0 && reservationResult[0]?.max_sequence !== null) {
            const maxSeq = Number(reservationResult[0].max_sequence);
            if (!isNaN(maxSeq) && maxSeq > 0) {
              maxSequenceFromReservations = maxSeq;
            }
          }

          // Calculate next sequence (max of both + 1)
          const sequence = Math.max(maxSequenceFromRequisitions, maxSequenceFromReservations) + 1;
          
          console.log('[Requisition Number] Max from requisitions:', maxSequenceFromRequisitions);
          console.log('[Requisition Number] Max from reservations:', maxSequenceFromReservations);
          console.log('[Requisition Number] Next sequence:', sequence);

          // Generate requisition number (vessel push may supply V.* from Actinium-sm)
          const requisitionNumber =
            clientRequisitionNumber ??
            generateRequisitionNumberForOrigin(
              vessel,
              requisitionType,
              year,
              sequence,
              origin
            );
          const initialStatus = initialStatusForNewRequisition(
            generationStatus,
            prefix,
            accessLevel
          );
          const isEditable =
            initialStatus === RequisitionStatus.NOT_READY &&
            generationStatus === GenerationStatus.SAVED_AS_DRAFT;

          // For spare requisitions, check and create spare parts if they don't exist
          // Or update ROB if they do exist and ROB is provided
          if (requisitionType === RequisitionType.SPR) {
            const { resolveMachineryIdForRequisitionSpareItem } = await import(
              '@/lib/spares-inventory/resolve-machinery-id-for-requisition-item'
            );
            for (const item of itemsList) {
              // Only process if marked for inventory (default true)
              if (item.addToInventory === false) continue;

              if (item.machineryInstanceId && item.partNumber && item.partName) {
                const machineryId = await resolveMachineryIdForRequisitionSpareItem(
                  tx,
                  item.machineryInstanceId
                );
                if (!machineryId) continue;

                const existingPart = await tx.sparePart.findFirst({
                  where: {
                    machineryId,
                    sparePartNumber: item.partNumber,
                    isActive: true,
                  },
                });

                if (existingPart) {
                  const rob =
                    item.currentRob !== undefined && item.currentRob !== null
                      ? Number(item.currentRob)
                      : NaN;
                  await tx.sparePart.update({
                    where: { id: existingPart.id },
                    data: {
                      ...(!isNaN(rob) ? { quantity: rob } : {}),
                      ...(item.plateNumber?.trim()
                        ? { plateNumber: item.plateNumber.trim() }
                        : {}),
                    },
                  });
                } else {
                  const vesselBox = await tx.box.findFirst({
                    where: { vesselId, isActive: true },
                  });

                  if (vesselBox) {
                    const rob = Number(item.currentRob);
                    await tx.sparePart.create({
                      data: {
                        vesselId,
                        name: item.partName,
                        sparePartNumber: item.partNumber,
                        plateNumber: item.plateNumber?.trim() || null,
                        boxId: vesselBox.id,
                        machineryId,
                        machineryInstanceId: null,
                        componentInstanceId: null,
                        quantity: !isNaN(rob) ? rob : 0,
                        unit: item.unit || 'PCS',
                        description: item.description,
                        remarks: item.remarks,
                      },
                    });
                  }
                }
              }
            }

            const { upsertMainEnginePlateCatalogFromRequisitionItems } = await import(
              "@/lib/spares-inventory/main-engine-plate-catalog"
            );
            await upsertMainEnginePlateCatalogFromRequisitionItems(tx, {
              vesselId,
              items: itemsList,
            });
          }

          // Create requisition with items - unique constraint will catch duplicates
          return await tx.requisition.create({
            data: {
              id: requisitionRowId,
              requisitionNumber,
              heading,
              manualReqNumber,
              description,
              portOfSupply,
              requisitionType,
              requisitionPurpose: requisitionPurpose || "ROUTINE_MAINTENANCE",
              priority: priority === "URGENT" || priority === "CRITICAL" ? priority : "NORMAL",
              generationStatus,
              status: initialStatus,
              portAgentDetails,
              isEditable,
              createdById,
              vesselId,
              contractId: contractId || undefined,
              budgetCode: finalBudgetCode,
              isBudgeted,
              glCode: glCode || undefined,
              costCenter: costCenter || undefined,
              subCategoryCode: resolvedSubCategoryCode || undefined,
              lubeOilSupplierId: resolvedLubeOilSupplierId ?? undefined,
              storeLocationId: storeLocationId ?? undefined,
              detailsJson: requisitionDetailsJson ?? "{}",
              items: {
                create: items.map((item: any) => ({
                  itemName: item.itemName,
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  urgency: item.urgency,
                  remarks: item.remarks,
                  impaNumber: item.impaCode || item.impaNumber || null,
                  machineryInstanceId:
                    requisitionType === RequisitionType.LUB
                      ? undefined
                      : item.machineryInstanceId && item.machineryInstanceId !== ""
                        ? item.machineryInstanceId
                        : undefined,
                  manualMachineryName: item.manualMachineryName,
                  partNumber: item.partNumber,
                  plateNumber: item.plateNumber?.trim() || null,
                  partName: item.partName,
                  itemNumber: item.itemNumber,
                  drawingNumber: item.drawingNumber,
                  currentRob: item.currentRob,
                  addToInventory: item.addToInventory,
                  oilGrade: item.oilGrade,
                  paintBrand: item.paintBrand,
                  paintProductName: item.paintProductName,
                  paintColorGrade: item.paintColorGrade,
                  paintColorName: item.paintColorName,
                  paintColorHex: item.paintColorHex,
                  paintType: item.paintType,
                  paintCategory: item.paintCategory,
                })),
              },
            },
            include: {
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  designation: true,
                },
              },
              vessel: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              items: true,
            },
          });
        }, {
          isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
        });

        // Successfully created, break out of retry loop
        break;
      } catch (error: any) {
        // Check if it's a unique constraint violation (P2002)
        if (error.code === 'P2002' && error.meta?.target?.includes('requisition_number')) {
          retries++;
          if (retries >= maxRetries) {
            console.error("Failed to generate unique requisition number after max retries");
            return NextResponse.json(
              { error: "Failed to generate unique requisition number. Please try again." },
              { status: 500 }
            );
          }
          // Wait a small random amount before retrying to avoid thundering herd
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          continue;
        }
        // If it's not a unique constraint error, throw it
        throw error;
      }
    }

    if (!requisition) {
      return NextResponse.json(
        { error: "Failed to create requisition" },
        { status: 500 }
      );
    }

    // Link drawing attachments (uploaded before requisition create) to this requisition
    const drawingIds = Array.isArray(drawingAttachmentIds) ? drawingAttachmentIds.filter((id: unknown) => typeof id === "string") : [];
    if (drawingIds.length > 0) {
      await prisma.requisitionDrawingAttachment.updateMany({
        where: {
          id: { in: drawingIds },
          requisitionId: null,
          uploadedById: createdById,
        },
        data: { requisitionId: requisition.id },
      });
    }

    // Record purchase history
    await recordPurchaseHistory({
      requisitionId: requisition.id,
      actionType: PurchaseHistoryActionType.CREATED,
      performedById: createdById,
      actionDescription: `Requisition ${requisition.requisitionNumber} created`,
      newStatus: requisition.status,
      newValue: {
        heading: requisition.heading,
        requisitionType: requisition.requisitionType,
        itemsCount: requisition.items.length,
      },
    });

    // Notify shore approvers (deduped with sync backfill)
    try {
      await notifyRequisitionApprovalPending({
        request,
        actorUserId: createdById,
        requisitionId: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        vesselId,
        stage: "CREATED_NOT_READY",
        metadata: {
          heading: requisition.heading,
          requisitionType: requisition.requisitionType,
          itemsCount: requisition.items.length,
        },
      });
    } catch (activityError: unknown) {
      console.error("Error logging activity:", activityError);
    }

    return NextResponse.json(requisition, { status: 201 });
  } catch (error) {
    console.error("Error creating requisition:", error);
    return NextResponse.json(
      { error: "Failed to create requisition" },
      { status: 500 }
    );
  }
}
