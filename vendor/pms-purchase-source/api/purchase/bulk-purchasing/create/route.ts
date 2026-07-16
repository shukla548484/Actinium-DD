import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { generatePONumber } from "@/lib/services/po-number-generator";
import { generatePOPDF } from "@/lib/services/po-pdf-generator";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { sendGmailEmail } from "@/lib/gmail-server";
import { storeEmailMessage } from "@/lib/email-storage";
import { z } from "zod";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

const bulkOrderSchema = z.object({
  requisitionIds: z.array(z.string().uuid()).min(1, "At least one requisition is required"),
  contractId: z.string().uuid().optional(),
});

/**
 * POST /api/purchase/bulk-purchasing/create
 * Create consolidated bulk purchase orders grouped by vendor
 * This follows Actinium-sm bulk purchasing pattern:
 * - Groups requisitions by vendor (based on approved quotes)
 * - Aggregates items within each vendor group
 * - Creates one PO per vendor with consolidated items
 * - Links multiple requisitions to each PO via junction table
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (![32, 33].includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Purchasing managers (32, 33) or administrators (50 / 99 / 100) required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = bulkOrderSchema.parse(body);

    // Fetch all requisitions with their approved quotes
    const requisitions = await prisma.requisition.findMany({
      where: {
        id: { in: validatedData.requisitionIds },
        status: "REQ_APPROVED",
      },
      include: {
        items: true,
        vessel: true,
        vendorQuotes: {
          where: { status: "APPROVED" },
          include: {
            vendor: true,
            quotedItems: {
              orderBy: {
                itemName: 'asc',
              },
            },
          },
        },
      },
    });

    if (requisitions.length === 0) {
      return NextResponse.json(
        { error: "No approved requisitions found" },
        { status: 400 }
      );
    }

    // Filter requisitions that have approved quotes
    const requisitionsWithQuotes = requisitions.filter(
      (req) => req.vendorQuotes.length > 0
    );

    if (requisitionsWithQuotes.length === 0) {
      return NextResponse.json(
        { error: "No requisitions with approved quotes found" },
        { status: 400 }
      );
    }

    // Group requisitions by vendor (using approved quote's vendor)
    const vendorGroups = new Map<string, {
      vendorId: string;
      vendor: any;
      requisitions: typeof requisitionsWithQuotes;
      quotes: any[];
    }>();

    for (const requisition of requisitionsWithQuotes) {
      const approvedQuote = requisition.vendorQuotes[0]; // Use first approved quote
      const vendorId = approvedQuote.vendorId;

      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, {
          vendorId,
          vendor: approvedQuote.vendor,
          requisitions: [],
          quotes: [],
        });
      }

      const group = vendorGroups.get(vendorId)!;
      group.requisitions.push(requisition);
      group.quotes.push(approvedQuote);
    }

    // Create consolidated purchase orders (one per vendor)
    const createdPOs: any[] = [];
    const errors: string[] = [];

    for (const [vendorId, group] of vendorGroups.entries()) {
      try {
        // Aggregate items from all requisitions for this vendor
        const aggregatedItems = new Map<string, {
          itemName: string;
          totalQuantity: number;
          unit: string;
          unitPrice: number | null;
          totalPrice: number | null;
          requisitionNumbers: string[];
          descriptions: string[];
        }>();

        let totalAmount = 0;
        let currency = "USD";

        // Aggregate items from quoted items
        for (const quote of group.quotes) {
          currency = quote.currency || currency;
          
          for (const quotedItem of quote.quotedItems) {
            const key = `${quotedItem.itemName}_${quotedItem.unit}`;
            
            if (aggregatedItems.has(key)) {
              const existing = aggregatedItems.get(key)!;
              existing.totalQuantity += Number(quotedItem.quantity);
              if (quotedItem.totalPrice) {
                existing.totalPrice = (existing.totalPrice || 0) + Number(quotedItem.totalPrice);
              }
            } else {
              aggregatedItems.set(key, {
                itemName: quotedItem.itemName,
                totalQuantity: Number(quotedItem.quantity),
                unit: quotedItem.unit,
                unitPrice: quotedItem.unitPrice ? Number(quotedItem.unitPrice) : null,
                totalPrice: quotedItem.totalPrice ? Number(quotedItem.totalPrice) : null,
                requisitionNumbers: [],
                descriptions: quotedItem.description ? [quotedItem.description] : [],
              });
            }
          }
        }

        // Add requisition numbers to items
        for (const req of group.requisitions) {
          for (const item of Array.from(aggregatedItems.values())) {
            if (req.items.some(ri => ri.itemName === item.itemName && ri.unit === item.unit)) {
              if (!item.requisitionNumbers.includes(req.requisitionNumber)) {
                item.requisitionNumbers.push(req.requisitionNumber);
              }
            }
          }
        }

        // Calculate total amount
        for (const item of aggregatedItems.values()) {
          if (item.totalPrice) {
            totalAmount += item.totalPrice;
          }
        }

        // Use the first requisition as the primary requisition for the PO
        const primaryRequisition = group.requisitions[0];
        const primaryQuote = group.quotes[0];

        // Generate PO number using the primary requisition's vessel and type
        const poNumber = await generatePONumber(
          primaryRequisition.vesselId,
          primaryRequisition.requisitionType
        );

        // Create the consolidated purchase order
        const purchaseOrder = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            requisitionId: primaryRequisition.id, // Primary requisition
            quoteId: primaryQuote.id, // Primary quote
            vesselId: primaryRequisition.vesselId,
            vesselName: primaryRequisition.vessel?.name || 'Unknown Vessel', // Store vessel name directly
            dateOfIssue: new Date(),
            totalAmount: totalAmount > 0 ? totalAmount : primaryQuote.totalAmount ? Number(primaryQuote.totalAmount) : null,
            currency,
            status: "ACTIVE",
            contractId: validatedData.contractId || primaryRequisition.contractId || undefined,
            budgetCode: primaryRequisition.budgetCode || undefined,
            glCode: primaryRequisition.glCode || undefined,
            costCenter: primaryRequisition.costCenter || undefined,
          },
          include: {
            requisition: {
              include: {
                vessel: true,
              },
            },
            quote: {
              include: {
                vendor: true,
              },
            },
          },
        });

        // Link all requisitions to this PO via junction table
        // Check if bulk_po_requisitions table exists
        try {
          // Use Prisma's raw query with proper parameterization
          const values = group.requisitions.map((_, i) => 
            `($${i * 2 + 1}::uuid, $${i * 2 + 2}::uuid)`
          ).join(', ');
          
          const params = group.requisitions.flatMap(r => [purchaseOrder.id, r.id]);
          
          await prisma.$executeRawUnsafe(
            `INSERT INTO bulk_po_requisitions (purchase_order_id, requisition_id)
             VALUES ${values}
             ON CONFLICT (purchase_order_id, requisition_id) DO NOTHING`,
            ...params
          );
        } catch (junctionError: any) {
          // If junction table doesn't exist, log but continue
          console.warn('Could not create bulk PO requisition links:', junctionError.message);
          // Try alternative approach using Prisma if table exists but query failed
          try {
            for (const req of group.requisitions) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO bulk_po_requisitions (purchase_order_id, requisition_id)
                 VALUES ($1::uuid, $2::uuid)
                 ON CONFLICT (purchase_order_id, requisition_id) DO NOTHING`,
                purchaseOrder.id,
                req.id
              );
            }
          } catch (altError) {
            console.warn('Alternative bulk PO link creation also failed:', altError);
          }
        }

        // Generate PDF for the consolidated PO
        try {
          // Create a consolidated quote object for PDF generation
          const consolidatedQuote = {
            ...primaryQuote,
            quotedItems: Array.from(aggregatedItems.values()).map(item => ({
              itemName: item.itemName,
              quantity: item.totalQuantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              description: item.descriptions.join('; '),
            })),
            totalAmount: totalAmount > 0 ? totalAmount : primaryQuote.totalAmount,
          };

          const pdfBuffer = await generatePOPDF({
            poNumber,
            dateOfIssue: purchaseOrder.dateOfIssue,
            requisition: primaryRequisition,
            quote: consolidatedQuote as any,
            userRemarks: `Bulk Purchase Order - Consolidating ${group.requisitions.length} requisition(s): ${group.requisitions.map(r => r.requisitionNumber).join(', ')}`,
            vendorRemarks: undefined,
            conditions: undefined,
            leadTime: undefined,
            portOfDelivery: undefined,
            agentDetails: undefined,
          });

          // Upload PDF to GCS
          const gcs = getGoogleCloudStorageService();
          const fileName = `PO_${poNumber}_${primaryRequisition.vessel.code || 'BULK'}_${new Date().toISOString().split('T')[0]}.pdf`;
          const uploadResult = await gcs.uploadFile(
            pdfBuffer,
            fileName,
            'application/pdf',
            {
              vesselId: primaryRequisition.vesselId,
              category: 'purchase',
              subfolder: `purchase-orders/${purchaseOrder.id}`,
            }
          );

          // Update PO with PDF URL
          await prisma.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: { originalPdfUrl: uploadResult.fileUrl },
          });
        } catch (pdfError) {
          console.error('Error generating PDF for bulk PO:', pdfError);
          // Continue even if PDF generation fails
        }

        createdPOs.push({
          ...purchaseOrder,
          requisitionCount: group.requisitions.length,
          requisitionNumbers: group.requisitions.map(r => r.requisitionNumber),
          aggregatedItems: Array.from(aggregatedItems.values()),
        });
      } catch (error: any) {
        console.error(`Error creating bulk PO for vendor ${vendorId}:`, error);
        errors.push(`Failed to create PO for vendor ${group.vendor.name}: ${error.message}`);
      }
    }

    if (createdPOs.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to create any purchase orders",
          details: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdPOs.length} consolidated purchase order(s) from ${requisitionsWithQuotes.length} requisition(s)`,
      purchaseOrders: createdPOs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating bulk order:", error);
    return NextResponse.json(
      { error: "Failed to create bulk order", details: error.message },
      { status: 500 }
    );
  }
}
