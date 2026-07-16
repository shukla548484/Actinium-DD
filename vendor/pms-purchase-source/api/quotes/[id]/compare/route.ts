import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { secureApiRoute, SecureRequestContext, validateUUID, validateCompanyAccess } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { getExchangeRate, getVesselBaseCurrency, BASE_CURRENCY } from '@/lib/utils/currency';
import {
  countStatusReceivedWithoutPrices,
  dedupeVendorQuotesByLatest,
  isVendorQuoteComparable,
  vendorQuoteHasComparablePrices,
} from '@/lib/procurement/vendor-quote-receipt';
import { matchQuoteLineToRequisitionItem } from '@/lib/procurement/match-quote-requisition-item';
import {
  assignRequisitionLineNumbers,
  getRequisitionLineNumber,
} from '@/lib/procurement/requisition-line-identity';

function prismaErrorText(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return [err.message, err.code, JSON.stringify(err.meta ?? {})].join(' ');
  }
  if (err instanceof Error) {
    return [err.message, err.cause instanceof Error ? err.cause.message : ''].join(' ');
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Schema ahead of DB (missing column). Prisma often shows `(not available)` instead of the name. */
function isMissingColumnDbError(err: unknown): boolean {
  const t = prismaErrorText(err).toLowerCase();
  return (
    t.includes('does not exist in the current database') ||
    (t.includes('not available') && t.includes('does not exist')) ||
    t.includes('quote_to_usd_rate') ||
    t.includes('42703') ||
    (t.includes('column') && t.includes('does not exist'))
  );
}

/** Extract GCS object path from a storage URL; returns null if not a GCS URL. */
function gcsObjectPathFromFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl || !fileUrl.includes('storage.googleapis.com/')) return null;
  const urlParts = fileUrl.split('storage.googleapis.com/');
  if (urlParts.length < 2) return null;
  const pathAfterBucket = urlParts[1];
  const pathParts = pathAfterBucket.split('/');
  if (pathParts.length < 2) return null;
  return pathParts.slice(1).join('/').split('?')[0] || null;
}

/**
 * GET /api/quotes/[id]/compare - Compare quotes for a requisition
 * SECURITY: Protected by secureApiRoute - requires authentication
 * Access Requirements:
 * - User must have Purchase module assigned (or access level 50)
 * - User must have access to the requisition's vessel (assigned vessel or access level 50)
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id: string } | Promise<{ id: string }>
) => {
  try {
    // Handle Next.js 15 params (can be Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: 'Requisition ID is required' },
        { status: 400 }
      );
    }
    
    const id = validateUUID(resolvedParams.id, 'Requisition ID');
    if (!id) {
      return NextResponse.json(
        { error: 'Invalid requisition ID' },
        { status: 400 }
      );
    }
    
    const currentUser = context.user;

    // Check if user has Purchase module access
    // Access level 50 (admin) bypasses module restrictions
    const isAdmin = isAdminEquivalentAccessLevel(currentUser.designationAccessLevel);
    let hasPurchaseModule = false;

    if (isAdmin) {
      hasPurchaseModule = true; // Admin has access to all modules
    } else {
      // Check if user has Purchase module assigned
      const assignedModules = currentUser.assignedModules || [];
      hasPurchaseModule = assignedModules.some((am: any) => {
        const moduleName = am.module?.name || am.name;
        return moduleName === 'Purchase';
      });
    }

    if (!hasPurchaseModule) {
      return NextResponse.json(
        { error: 'Access denied. Purchase module access required.' },
        { status: 403 }
      );
    }

    const compareIncludeBase = {
      items: {
        include: {
          defect: {
            select: {
              id: true,
              defectCode: true,
              heading: true,
            },
          },
        },
      },
      vessel: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      childRequisitions: {
        select: { id: true, requisitionNumber: true },
      },
    };

    const vendorQuotesQuery: Prisma.Requisition$vendorQuotesArgs = {
      where: {
        AND: [
          {
            quotedItems: {
              some: {},
            },
          },
          {
            status: {
              in: ['RECEIVED', 'APPROVED'],
            },
          },
        ],
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            rating: true,
          },
        },
        quotedItems: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        emails: {
          include: {
            attachments: true,
          },
          orderBy: {
            receivedAt: 'desc',
          },
          take: 1,
        },
      },
    };

    /** Explicit scalar `select` for vendor quotes (no `quote_to_usd_rate`) when DB is behind Prisma schema. */
    const vendorQuotesFallbackSelect: Prisma.Requisition$vendorQuotesArgs = {
      where: vendorQuotesQuery.where,
      select: {
        id: true,
        requisitionId: true,
        vendorId: true,
        quoteNumber: true,
        totalAmount: true,
        currency: true,
        validUntil: true,
        status: true,
        notes: true,
        attachments: true,
        sentAt: true,
        receivedAt: true,
        uniqueEmailId: true,
        additionalCharges: true,
        deliveryCharges: true,
        otherChargesBreakdown: true,
        termsAndConditions: true,
        deliveryTerms: true,
        paymentTerms: true,
        packingCharges: true,
        deliveryPort: true,
        exWorkLocation: true,
        quotationReference: true,
        createdAt: true,
        updatedAt: true,
        ihmDeclaration: true,
        leadTime: true,
        validityPeriod: true,
        deliveryChargesAttachment: true,
        grossAmountBeforeDiscount: true,
        netAmountAfterDiscount: true,
        vendor: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            rating: true,
          },
        },
        quotedItems: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            quoteId: true,
            requisitionItemId: true,
            itemName: true,
            description: true,
            quantity: true,
            unit: true,
            unitPrice: true,
            totalPrice: true,
            deliveryTime: true,
            remarks: true,
            discountPercent: true,
            expectedDeliveryPort: true,
            expectedDeliveryDate: true,
            itemRemarks: true,
            createdAt: true,
            updatedAt: true,
            drawingNumber: true,
            partNumber: true,
          },
        },
        emails: {
          take: 1,
          orderBy: { receivedAt: 'desc' },
          include: {
            attachments: true,
          },
        },
      },
    };

    let persistQuoteToUsdRate = true;
    let requisition;

    try {
      requisition = await prisma.requisition.findUnique({
        where: { id },
        include: {
          ...compareIncludeBase,
          vendorQuotes: vendorQuotesQuery,
        },
      });
    } catch (err) {
      if (!isMissingColumnDbError(err)) {
        throw err;
      }
      persistQuoteToUsdRate = false;
      console.warn(
        '[quotes/compare] Missing DB column vs schema (e.g. quote_to_usd_rate). Retrying with explicit vendorQuotes select. Apply migration 20260409120000_add_vendor_quote_quote_to_usd_rate.'
      );
      try {
        requisition = await prisma.requisition.findUnique({
          where: { id },
          include: {
            ...compareIncludeBase,
            vendorQuotes: vendorQuotesFallbackSelect,
          },
        });
      } catch (err2) {
        console.error('[quotes/compare] Fallback query failed:', prismaErrorText(err2));
        throw err2;
      }
    }

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Check if user has access to the requisition's vessel
    // Access level 50 (admin) bypasses vessel restrictions
    // Note: Vessel access is checked via company access if needed
    // For now, we rely on the module access check above

    // One quote per vendor (latest response) — same rule as requisition list quoteStats.
    const uniqueQuotes = dedupeVendorQuotesByLatest(requisition.vendorQuotes);

    // Only show a card when the vendor has quoted at least one item (has price for at least one line).
    const quotesWithData = uniqueQuotes.filter((quote) => {
      const shouldInclude = isVendorQuoteComparable(quote);

      if (!shouldInclude) {
        const hasPrices = vendorQuoteHasComparablePrices(quote.quotedItems);
        console.log(
          `⏭️  Excluding quote ${quote.id} from vendor ${quote.vendor.name} - status: ${quote.status}, hasQuotedAnyItem: ${hasPrices}`
        );
      }

      return shouldInclude;
    });

    const importPendingCount = countStatusReceivedWithoutPrices(uniqueQuotes);

    console.log(`📊 Quote comparison: ${quotesWithData.length} received quote(s) (really quoted: portal or email)`);

    // Compare quotes with enhanced fields - use quotesWithData instead of uniqueQuotes
    const gcs = getGoogleCloudStorageService();

    const quoteToUsdById = new Map<string, number>();
    for (const quote of quotesWithData) {
      const cur = (quote.currency || BASE_CURRENCY).trim().toUpperCase();
      let rate: number;
      if (cur === BASE_CURRENCY) {
        rate = 1;
        if (persistQuoteToUsdRate && quote.quoteToUsdRate == null) {
          try {
            await prisma.vendorQuote.update({
              where: { id: quote.id },
              data: { quoteToUsdRate: 1 },
            });
          } catch (updErr) {
            console.warn('[quotes/compare] Could not persist quoteToUsdRate=1:', updErr);
          }
        }
      } else if (quote.quoteToUsdRate != null) {
        rate = Number(quote.quoteToUsdRate);
      } else {
        const asOf = quote.receivedAt ?? quote.createdAt ?? new Date();
        rate = await getExchangeRate(cur, BASE_CURRENCY, new Date(asOf));
        if (persistQuoteToUsdRate) {
          try {
            await prisma.vendorQuote.update({
              where: { id: quote.id },
              data: { quoteToUsdRate: rate },
            });
          } catch (updErr) {
            console.warn('[quotes/compare] Could not persist quoteToUsdRate:', updErr);
          }
        }
      }
      quoteToUsdById.set(quote.id, rate);
    }

    async function buildQuoteRow(quote: (typeof quotesWithData)[number]) {
      const allAttachments = quote.emails
        .flatMap((email) => email.attachments);
      const preferredAttachment = allAttachments.find((att) =>
        att.filename.toLowerCase().endsWith('.xlsx') ||
        att.filename.toLowerCase().endsWith('.xls')
      );
      const refCandidates = allAttachments.filter((att) => {
        const lower = att.filename.toLowerCase();
        const notExcel = !lower.endsWith('.xlsx') && !lower.endsWith('.xls');
        return notExcel && !!att.fileUrl;
      });
      const referenceDocuments: { id: string; filename: string; fileUrl: string | null }[] = [];
      for (const a of refCandidates) {
        const objectPath = gcsObjectPathFromFileUrl(a.fileUrl);
        if (objectPath && (await gcs.fileExists(objectPath))) {
          referenceDocuments.push({ id: a.id, filename: a.filename, fileUrl: a.fileUrl });
        }
      }

      let validityPeriodDays: number | null = null;
      if (quote.validUntil) {
        const today = new Date();
        const validUntil = new Date(quote.validUntil);
        const diffTime = validUntil.getTime() - today.getTime();
        validityPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const reqItems = assignRequisitionLineNumbers(
        requisition.items.map((ri) => ({
          id: ri.id,
          itemName: ri.itemName,
          impaNumber: ri.impaNumber,
          itemNumber: (ri as { itemNumber?: string | null }).itemNumber,
          partNumber: (ri as { partNumber?: string | null }).partNumber,
          quantity: Number(ri.quantity),
          unit: ri.unit,
        }))
      );
      const quoteLinesForMatch = quote.quotedItems.map((qi, quoteItemIndex) => ({
        id: qi.id,
        requisitionItemId: qi.requisitionItemId,
        lineNumber: qi.requisitionItemId
          ? getRequisitionLineNumber(qi.requisitionItemId, reqItems)
          : quoteItemIndex + 1,
        itemName: qi.itemName,
        partNumber: qi.partNumber,
        quantity: qi.quantity != null ? Number(qi.quantity) : null,
        unit: qi.unit,
      }));
      const reqIdByQuoteLineId = new Map<string, string>();
      for (const ri of reqItems) {
        const matched = matchQuoteLineToRequisitionItem(quoteLinesForMatch, ri, reqItems);
        if (matched?.id) {
          reqIdByQuoteLineId.set(matched.id, ri.id);
        }
      }

      return {
        quoteId: quote.id,
        status: quote.status,
        quoteNumber: quote.quoteNumber,
        quotationReference: quote.quotationReference,
        vendor: {
          id: quote.vendor.id,
          name: quote.vendor.name,
          email: quote.vendor.primaryEmail,
          rating: quote.vendor.rating || null,
        },
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        quoteToUsdRate: quoteToUsdById.get(quote.id) ?? 1,
        localCurrency: quote.currency,
        localCurrencyAmount: quote.totalAmount,
        validUntil: quote.validUntil,
        validityPeriodDays,
        validityPeriod: quote.validityPeriod ?? null,
        receivedAt: quote.receivedAt ?? (quote as any).createdAt ?? null,
        itemCount: quote.quotedItems.length,
        fileUrl: preferredAttachment?.fileUrl || null,
        fileName: preferredAttachment?.filename || null,
        fileAttachmentId: preferredAttachment?.id || null,
        attachments: allAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          fileUrl: a.fileUrl,
        })),
        referenceDocuments,
        additionalCharges: quote.additionalCharges,
        deliveryCharges: quote.deliveryCharges,
        deliveryChargesAttachment: quote.deliveryChargesAttachment,
        otherChargesBreakdown: quote.otherChargesBreakdown as Record<string, number> | null,
        packingCharges: quote.packingCharges,
        termsAndConditions: quote.termsAndConditions,
        deliveryTerms: quote.deliveryTerms,
        paymentTerms: quote.paymentTerms,
        deliveryPort: quote.deliveryPort,
        exWorkLocation: quote.exWorkLocation,
        leadTime: quote.leadTime,
        portOfSupply: requisition.portOfSupply,
        items: quote.quotedItems.map((item, quoteItemIndex) => {
          const requisitionItem =
            (item.requisitionItemId
              ? reqItems.find((r) => r.id === item.requisitionItemId)
              : null) ??
            (item.id && reqIdByQuoteLineId.has(item.id)
              ? reqItems.find((r) => r.id === reqIdByQuoteLineId.get(item.id))
              : null) ??
            reqItems[quoteItemIndex] ??
            null;
          return {
            id: item.id,
            requisitionItemId: item.requisitionItemId ?? requisitionItem?.id ?? null,
            lineNumber: item.requisitionItemId
              ? getRequisitionLineNumber(item.requisitionItemId, reqItems)
              : quoteItemIndex + 1,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            deliveryTime: item.deliveryTime ? (typeof item.deliveryTime === 'string' ? item.deliveryTime : String(item.deliveryTime)) : null,
            discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
            expectedDeliveryPort: item.expectedDeliveryPort,
            expectedDeliveryDate: item.expectedDeliveryDate,
            remarks: item.remarks,
            itemRemarks: item.itemRemarks,
            impaNumber: item.partNumber || null,
            partNumber: item.partNumber || null,
          };
        }),
      };
    }

    const comparison = await Promise.all(quotesWithData.map(buildQuoteRow));

    const vesselLocalCurrency =
      requisition.vesselId != null
        ? await getVesselBaseCurrency(requisition.vesselId)
        : null;
    const vesselLocalCurrencyForContext =
      vesselLocalCurrency && vesselLocalCurrency !== BASE_CURRENCY
        ? vesselLocalCurrency
        : null;

    // Sort by total amount (lowest first)
    comparison.sort((a, b) => {
      const amountA = a.totalAmount ? Number(a.totalAmount) : Infinity;
      const amountB = b.totalAmount ? Number(b.totalAmount) : Infinity;
      return amountA - amountB;
    });

    return NextResponse.json({
      success: true,
      requisition: {
        id: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        heading: requisition.heading,
        isBudgeted: requisition.isBudgeted ?? null,
        budgetCode: requisition.budgetCode,
        portOfSupply: requisition.portOfSupply,
        vesselLocalCurrency: vesselLocalCurrencyForContext,
        status: requisition.status,
        parentRequisitionId: requisition.parentRequisitionId ?? null,
        childRequisitions: requisition.childRequisitions?.map((c) => ({ id: c.id, requisitionNumber: c.requisitionNumber })) ?? [],
        items: requisition.items.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          urgency: item.urgency,
          impaNumber: item.impaNumber,
          defect: item.defect ? {
            id: item.defect.id,
            defectCode: item.defect.defectCode,
            heading: item.defect.heading,
          } : null,
        })),
      },
      comparison: comparison,
      quotes: comparison, // Keep for backward compatibility
      importSummary: {
        comparableCount: quotesWithData.length,
        importPendingCount,
        statusReceivedWithoutPrices: importPendingCount,
      },
      lowestQuote: comparison.length > 0 ? comparison[0] : null,
      highestQuote: comparison.length > 0 ? comparison[comparison.length - 1] : null,
      baseCurrency: 'USD', // Base currency for conversion
      
      // NEW: Currency context for multi-currency display
      currencyContext: {
        baseCurrency: 'USD',
        vesselLocalCurrency: vesselLocalCurrencyForContext,
        availableCurrencies: [...new Set(comparison.map((q) => q.currency).filter(Boolean))],
        rateSource: 'frozen',
      },
    });
  } catch (error: any) {
    console.error('Error comparing quotes:', error);
    return NextResponse.json(
      { error: 'Failed to compare quotes', details: error.message },
      { status: 500 }
    );
  }
};

// Export with security wrapper (Next.js 15 compatible)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return secureApiRoute<any>(
    async (req, ctx) => {
      return await handler(req, ctx, params);
    },
    { 
      requireAuth: true, 
      allowedMethods: ['GET'],
      requiredModule: 'Purchase' // Require Purchase module access
    }
  )(request, { params });
}



