import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { QuoteStatus } from '@prisma/client';
import { notifyQuoteReviewPending } from '@/lib/procurement/approval-notifications';
import { hasAtLeastOneQuotedCost } from '@/lib/quote-status-utils';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

/**
 * POST /api/quotes/create - Create a quote manually (for access levels 50, 32, 33)
 * This creates a quote as if it was received from a vendor
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (![32, 33].includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: 'Access denied. Only purchasing managers (32, 33) or administrators (50 / 99 / 100) can create quotes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      requisitionId,
      vendorId,
      quoteNumber,
      totalAmount,
      currency = 'USD',
      validUntil,
      notes,
      ihmDeclaration,
      paymentTerms,
      items, // Array of { itemName, description, quantity, unit, unitPrice, totalPrice, deliveryTime, remarks }
    } = body;

    // Validate required fields
    if (!requisitionId || !vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Requisition ID, Vendor ID, and at least one item are required' },
        { status: 400 }
      );
    }

    // Verify requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        items: true,
        vessel: true,
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Check if quote already exists for this requisition and vendor
    const existingQuote = await prisma.vendorQuote.findUnique({
      where: {
        requisitionId_vendorId: {
          requisitionId,
          vendorId,
        },
      },
    });

    if (existingQuote) {
      return NextResponse.json(
        { error: 'A quote already exists for this requisition and vendor' },
        { status: 409 }
      );
    }

    // Set RECEIVED and receivedAt only if at least one item has non-zero quoted cost
    const canSetReceived = hasAtLeastOneQuotedCost(items);

    // Create the quote
    const quote = await prisma.vendorQuote.create({
      data: {
        requisitionId,
        vendorId,
        quoteNumber: quoteNumber || null,
        totalAmount: totalAmount ? parseFloat(totalAmount.toString()) : null,
        currency,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || null,
        ihmDeclaration: ihmDeclaration || null,
        paymentTerms: paymentTerms || null,
        status: canSetReceived ? QuoteStatus.RECEIVED : QuoteStatus.SENT,
        receivedAt: canSetReceived ? new Date() : null,
        sentAt: new Date(),
        uniqueEmailId: `MANUAL-${Date.now().toString(36).toUpperCase()}`, // Unique ID for manual quotes
        quotedItems: {
          create: items.map((item: any) => ({
            itemName: item.itemName || 'Unknown Item',
            description: item.description || null,
            quantity: parseFloat(item.quantity?.toString() || '0'),
            unit: item.unit || 'PCS',
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : null,
            totalPrice: item.totalPrice ? parseFloat(item.totalPrice.toString()) : null,
            deliveryTime: item.deliveryTime || null,
            remarks: item.remarks || null,
          })),
        },
      },
      include: {
        vendor: true,
        quotedItems: true,
        requisition: {
          include: {
            vessel: true,
          },
        },
      },
    });

    // Update requisition status only when the new quote is actually received (has quoted cost)
    if (canSetReceived && (requisition.status === 'REQ_APPROVED' || requisition.status === 'SENT_FOR_QUOTE')) {
      await prisma.requisition.update({
        where: { id: requisitionId },
        data: {
          status: 'QUOTE_RECEIVED',
        },
      });
    }

    try {
      await notifyQuoteReviewPending({
        request,
        actorUserId: currentUser.id,
        requisitionId,
        requisitionNumber: requisition.requisitionNumber,
        vesselId: requisition.vesselId,
        companyId: requisition.vessel?.companyId,
        quoteId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          vendorName: quote.vendor.name,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
        },
      });
    } catch (activityError: unknown) {
      console.error('Error logging quote notification:', activityError);
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        vendor: {
          id: quote.vendor.id,
          name: quote.vendor.name,
          email: quote.vendor.primaryEmail,
        },
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        status: quote.status,
        receivedAt: quote.receivedAt,
        items: quote.quotedItems,
      },
    });
  } catch (error: any) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote', details: error.message },
      { status: 500 }
    );
  }
}






