import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { attachPoCostComparisonSummaries } from "@/lib/accounts/po-invoice-cost-comparison";
import {
  accountsReadyForPaymentStatusFilter,
  buildAccountsInvoiceVesselScope,
} from "@/lib/accounts/invoice-accounts-scope";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/invoices/ready-for-payment
 * Invoices approved for accounts payment (READY_FOR_PAYMENT + legacy LEVEL_FOUR_APPROVED).
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const search = searchParams.get("search");
    const vendorId = searchParams.get("vendorId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const { vesselFilter, forbidden } = await buildAccountsInvoiceVesselScope(
      {
        id: currentUser.id,
        designationAccessLevel: currentUser.designationAccessLevel,
        companyId: currentUser.companyId,
        company: currentUser.company,
      },
      vesselId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: "You do not have access to this vessel" },
        { status: 403 }
      );
    }

    const where: Prisma.InvoiceWhereInput = {
      status: accountsReadyForPaymentStatusFilter(),
    };

    if (vesselFilter && Object.keys(vesselFilter).length > 0) {
      where.requisition = vesselFilter;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            {
              requisition: {
                requisitionNumber: { contains: search, mode: "insensitive" },
              },
            },
            { vendor: { name: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) {
        where.invoiceDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.invoiceDate.lte = new Date(dateTo);
      }
    }

    const [invoices, total, summaryData] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          requisition: {
            include: {
              vessel: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  imoNumber: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              currency: true,
              completionStatus: true,
            },
          },
          quote: {
            select: {
              id: true,
              totalAmount: true,
              currency: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              primaryEmail: true,
              contactPerson: true,
              phone: true,
            },
          },
          levelOneApprover: {
            select: { id: true, firstName: true, lastName: true },
          },
          levelTwoApprover: {
            select: { id: true, firstName: true, lastName: true },
          },
          levelThreeApprover: {
            select: { id: true, firstName: true, lastName: true },
          },
          levelFourApprover: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { invoiceDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          invoiceAmount: true,
          quoteAmount: true,
        },
      }),
    ]);

    const totalInvoiceAmount = Number(summaryData._sum.invoiceAmount || 0);
    const totalQuoteAmount = Number(summaryData._sum.quoteAmount || 0);
    const totalDifference = totalInvoiceAmount - totalQuoteAmount;

    const invoicesWithComparison = await attachPoCostComparisonSummaries(prisma, invoices);

    const serializedInvoices = invoicesWithComparison.map((invoice) => ({
      ...invoice,
      invoiceAmount: Number(invoice.invoiceAmount),
      quoteAmount: Number(invoice.quoteAmount),
      differenceAmount: Number(invoice.differenceAmount),
      differencePercent:
        invoice.differencePercent != null ? Number(invoice.differencePercent) : null,
      purchaseOrder: invoice.purchaseOrder
        ? {
            ...invoice.purchaseOrder,
            totalAmount:
              invoice.purchaseOrder.totalAmount != null
                ? Number(invoice.purchaseOrder.totalAmount)
                : null,
          }
        : null,
      quote: invoice.quote
        ? {
            ...invoice.quote,
            totalAmount:
              invoice.quote.totalAmount != null ? Number(invoice.quote.totalAmount) : null,
          }
        : null,
      poAmount: invoice.poAmount,
      vesselConfirmedAmount: invoice.vesselConfirmedAmount,
      hasVesselReceipt: invoice.hasVesselReceipt,
    }));

    return NextResponse.json({
      success: true,
      invoices: serializedInvoices,
      summary: {
        totalInvoices: total,
        totalInvoiceAmount,
        totalQuoteAmount,
        totalDifference,
        averageDifference: invoices.length > 0 ? totalDifference / invoices.length : 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching invoices ready for payment:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: message },
      { status: 500 }
    );
  }
}
