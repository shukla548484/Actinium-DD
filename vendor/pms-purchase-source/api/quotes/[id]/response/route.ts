import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { QuoteStatus } from "@/lib/types/vendor";
import { RequisitionStatus, getIsEditableFromStatus } from "@/lib/types/requisition";
import { parseQuoteResponseExcel } from "@/lib/utils/email-quote";
import { hasAtLeastOneQuotedCost } from "@/lib/quote-status-utils";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/quotes/[id]/response - Process vendor quote response
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const quoteNumber = formData.get("quoteNumber") as string;
    const totalAmount = formData.get("totalAmount") as string;
    const currency = formData.get("currency") as string || "USD";
    const notes = formData.get("notes") as string;
    const receivedById = formData.get("receivedById") as string;

    if (!file) {
      return NextResponse.json(
        { error: "Quote response file is required" },
        { status: 400 }
      );
    }

    if (!receivedById) {
      return NextResponse.json(
        { error: "Receiver ID is required" },
        { status: 400 }
      );
    }

    // Check if quote exists
    const existingQuote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        requisition: true,
        vendor: true,
        quotedItems: true,
      },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    // Check if quote is in SENT status
    if (existingQuote.status !== QuoteStatus.SENT) {
      return NextResponse.json(
        { error: "Quote is not in sent status and cannot receive responses" },
        { status: 400 }
      );
    }

    // Check if quote is expired
    if (existingQuote.validUntil && new Date() > existingQuote.validUntil) {
      return NextResponse.json(
        { error: "Quote has expired and cannot receive responses" },
        { status: 400 }
      );
    }

    // Convert file to buffer and parse
    const buffer = Buffer.from(await file.arrayBuffer());
    let parsedItems;

    try {
      const parseResult = await parseQuoteResponseExcel(buffer);
      parsedItems = parseResult.items;
    } catch (parseError) {
      return NextResponse.json(
        { error: "Failed to parse quote response file. Please ensure it's a valid Excel file." },
        { status: 400 }
      );
    }

    // Set RECEIVED only if at least one item has a non-zero quoted cost (email/portal rule)
    const canSetReceived = hasAtLeastOneQuotedCost(parsedItems);

    // Update quote with response data
    const updatedQuote = await prisma.vendorQuote.update({
      where: { id },
      data: {
        ...(canSetReceived ? { status: QuoteStatus.RECEIVED, receivedAt: new Date() } : {}),
        quoteNumber: quoteNumber || undefined,
        totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
        currency,
        notes,
        quotedItems: {
          deleteMany: {}, // Remove existing items
          create: parsedItems.map(item => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            deliveryTime: item.deliveryTime,
            remarks: item.remarks,
          })),
        },
      },
      include: {
        vendor: true,
        quotedItems: true,
        requisition: true,
      },
    });

    // Check if all quotes for this requisition have been received
    const allQuotes = await prisma.vendorQuote.findMany({
      where: { requisitionId: existingQuote.requisitionId },
    });

    const receivedQuotes = allQuotes.filter(q => q.status === QuoteStatus.RECEIVED);
    const rejectedQuotes = allQuotes.filter(q => q.status === QuoteStatus.REJECTED);
    const respondedQuotes = receivedQuotes.length + rejectedQuotes.length; // All vendors who responded (received or rejected)
    const sentQuotes = allQuotes.filter(q => q.status === QuoteStatus.SENT);
    const totalSentQuotes = allQuotes.filter(q => 
      q.status === QuoteStatus.SENT || 
      q.status === QuoteStatus.RECEIVED || 
      q.status === QuoteStatus.REJECTED
    ).length; // Total quotes that were sent (including those that responded)

    // Update requisition status based on quote responses
    let newRequisitionStatus = existingQuote.requisition.status;

    // If all vendors have responded (either RECEIVED or REJECTED), status = QUOTE_RECEIVED
    if (respondedQuotes === totalSentQuotes && totalSentQuotes > 0) {
      // All vendors have responded (even if some declined/rejected)
      newRequisitionStatus = RequisitionStatus.QUOTE_RECEIVED;
    } else if (receivedQuotes.length > 0 || rejectedQuotes.length > 0) {
      // Some vendors have responded but not all
      newRequisitionStatus = RequisitionStatus.PARTIAL_QUOTE_RECEIVED;
    }

    if (newRequisitionStatus !== existingQuote.requisition.status) {
      await prisma.requisition.update({
        where: { id: existingQuote.requisitionId },
        data: { 
          status: newRequisitionStatus,
          isEditable: getIsEditableFromStatus(newRequisitionStatus), // Automatically set based on new status
        },
      });
    }

    // Store the uploaded file (in production, you'd save to cloud storage)
    // For now, we'll just log the file details
    console.log("Quote response file received:", {
      filename: file.name,
      size: file.size,
      quoteId: id,
      vendor: updatedQuote.vendor.name,
    });

    return NextResponse.json({
      message: "Quote response processed successfully",
      quote: {
        id: updatedQuote.id,
        vendor: updatedQuote.vendor,
        status: updatedQuote.status,
        quoteNumber: updatedQuote.quoteNumber,
        totalAmount: updatedQuote.totalAmount,
        currency: updatedQuote.currency,
        receivedAt: updatedQuote.receivedAt,
        itemCount: updatedQuote.quotedItems?.length || 0,
      },
      requisitionStatus: newRequisitionStatus,
    });
  } catch (error) {
    console.error("Error processing quote response:", error);
    return NextResponse.json(
      { error: "Failed to process quote response" },
      { status: 500 }
    );
  }
}

// GET /api/quotes/[id]/response - Get quote details for response form
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);

    const quote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        vendor: true,
        requisition: {
          include: {
            vessel: true,
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        quotedItems: true,
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      quote: {
        id: quote.id,
        status: quote.status,
        validUntil: quote.validUntil,
        vendor: quote.vendor,
        requisition: {
          id: quote.requisition.id,
          requisitionNumber: quote.requisition.requisitionNumber,
          heading: quote.requisition.heading,
          description: quote.requisition.description,
          portOfSupply: quote.requisition.portOfSupply,
          vessel: quote.requisition.vessel,
          createdBy: quote.requisition.createdBy,
          dateOfCreation: quote.requisition.dateOfCreation,
        },
        items: quote.quotedItems,
      },
    });
  } catch (error) {
    console.error("Error fetching quote details:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote details" },
      { status: 500 }
    );
  }
}
