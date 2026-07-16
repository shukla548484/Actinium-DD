import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext, sanitizeInput, validateUUID } from '@/lib/api-security';
import prisma from "@/lib/prisma";
import { QuoteStatus } from "@/lib/types/vendor";

// GET /api/quotes - List vendor quotes with filtering and pagination
// SECURITY: Protected by secureApiRoute - requires authentication
const getHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(sanitizeInput(searchParams.get("page")) || "1");
    const limit = parseInt(sanitizeInput(searchParams.get("limit")) || "30");
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const status = sanitizeInput(searchParams.get("status")) as QuoteStatus | null;
    const vendorIdRaw = searchParams.get("vendorId");
    const vendorId = vendorIdRaw ? (validateUUID(vendorIdRaw, 'Vendor ID') || vendorIdRaw) : "";
    const requisitionIdRaw = searchParams.get("requisitionId");
    const requisitionId = requisitionIdRaw ? (validateUUID(requisitionIdRaw, 'Requisition ID') || requisitionIdRaw) : "";
    const search = sanitizeInput(searchParams.get("search")) || "";
    const dateFrom = sanitizeInput(searchParams.get("dateFrom"));
    const dateTo = sanitizeInput(searchParams.get("dateTo"));
    const expired = searchParams.get("expired") === "true";

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (requisitionId) {
      where.requisitionId = requisitionId;
    }

    if (search) {
      where.OR = [
        { vendor: { name: { contains: search, mode: "insensitive" } } },
        { requisition: { heading: { contains: search, mode: "insensitive" } } },
        { requisition: { requisitionNumber: { contains: search, mode: "insensitive" } } },
        { quoteNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.sentAt = {};
      if (dateFrom) {
        where.sentAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.sentAt.lte = new Date(dateTo);
      }
    }

    if (expired) {
      where.validUntil = {
        lt: new Date(),
      };
      where.status = QuoteStatus.SENT; // Only sent quotes can be expired
    }
    
    // Filter by company for non-admin users
    if (![50, 99, 100].includes(context.user.designationAccessLevel ?? 0)) {
      // Add company filter through requisition -> vessel -> company
      where.requisition = {
        ...where.requisition,
        vessel: {
          companyId: context.companyId,
        },
      };
    }
    
    // Get quotes with pagination
    const [quotesResult, totalResult] = await Promise.all([
      prisma.vendorQuote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: "desc" },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              email: true,
              contactPerson: true,
              city: true,
              country: true,
            },
          },
          requisition: {
            select: {
              id: true,
              requisitionNumber: true,
              heading: true,
              status: true,
              vessel: {
                select: {
                  name: true,
                },
              },
            },
          },
          quotedItems: {
            select: {
              id: true,
              itemName: true,
              quantity: true,
              unit: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      }),
      prisma.vendorQuote.count({ where }),
    ]);

    const quotes = quotesResult || [];
    const total = totalResult || 0;

    // Calculate additional fields
    const quotesWithCalculatedFields = quotes.map((quote: any) => {
      return {
        ...quote,
        isExpired: quote.validUntil ? new Date() > quote.validUntil : false,
        itemCount: quote.quotedItems?.length || 0,
        quotedAmount: quote.quotedItems?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0,
      };
    });

    return NextResponse.json({
      quotes: quotesWithCalculatedFields,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
};

// DELETE /api/quotes - Bulk delete quotes (admin only)
// SECURITY: Protected by secureApiRoute - requires admin access (level 50)
const deleteHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const { quoteIds } = cleanData;

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json(
        { error: "Quote IDs are required" },
        { status: 400 }
      );
    }

    // Only allow deletion of quotes in DRAFT status (if implemented) or SENT status
    // In production, you might want to restrict this further
    const quotesToDelete = await prisma.vendorQuote.findMany({
      where: {
        id: { in: quoteIds },
        status: { in: [QuoteStatus.SENT] }, // Only allow deletion of sent quotes
      },
    });

    if (quotesToDelete.length !== quoteIds.length) {
      return NextResponse.json(
        { error: "Some quotes cannot be deleted (invalid status or not found)" },
        { status: 400 }
      );
    }

    // Delete quoted items first (cascade should handle this, but explicit is better)
    await prisma.quotedItem.deleteMany({
      where: {
        vendorQuoteId: { in: quoteIds },
      },
    });

    // Delete quotes
    const deleteResult = await prisma.vendorQuote.deleteMany({
      where: {
        id: { in: quoteIds },
      },
    });

    return NextResponse.json({
      message: `Successfully deleted ${deleteResult.count} quote${deleteResult.count > 1 ? 's' : ''}`,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error("Error deleting quotes:", error);
    return NextResponse.json(
      { error: "Failed to delete quotes" },
      { status: 500 }
    );
  }
};

// Export with security wrappers
export const GET = secureApiRoute(getHandler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 10, // Require at least level 10 to view quotes
});

export const DELETE = secureApiRoute(deleteHandler, {
  requireAuth: true,
  allowedMethods: ['DELETE'],
  minAccessLevel: 50, // Admin only - deleting quotes
});