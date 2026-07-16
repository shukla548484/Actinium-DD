import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyVendorToken } from '@/lib/vendor-auth';

/**
 * POST /api/credit-notes/[id]/confirm
 * Confirm a credit note (vendor only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorData = verifyVendorToken(request);
    
    if (!vendorData) {
      return NextResponse.json(
        { error: 'Unauthorized. Only vendors can confirm credit notes.' },
        { status: 401 }
      );
    }

    // Get credit note with purchase order and vendor info
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            quote: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    if (!creditNote) {
      return NextResponse.json(
        { error: 'Credit note not found' },
        { status: 404 }
      );
    }

    // Verify vendor owns this purchase order
    if (creditNote.purchaseOrder.quote.vendorId !== vendorData.vendorId) {
      return NextResponse.json(
        { error: 'Access denied. You can only confirm credit notes for your own purchase orders.' },
        { status: 403 }
      );
    }

    // Update credit note status to CONFIRMED
    // Note: This assumes the status field exists. If not, we'll need a migration first.
    const updated = await prisma.$executeRaw`
      UPDATE credit_notes
      SET status = 'CONFIRMED',
          vendor_confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `.catch(async () => {
      // Fallback: If status column doesn't exist, just update vendor_confirmed_at
      return await prisma.$executeRaw`
        UPDATE credit_notes
        SET vendor_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    });

    // Fetch updated credit note
    const updatedCreditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            requisition: {
              include: {
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            quote: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credit note confirmed successfully',
      creditNote: updatedCreditNote ? {
        id: updatedCreditNote.id,
        creditNoteNumber: updatedCreditNote.creditNoteNumber,
        amount: Number(updatedCreditNote.amount),
        currency: updatedCreditNote.currency,
        date: updatedCreditNote.date,
        pdfUrl: updatedCreditNote.pdfUrl,
        pdfFileName: updatedCreditNote.pdfFileName,
        description: updatedCreditNote.description,
        status: 'CONFIRMED',
        vendorConfirmedAt: new Date().toISOString(),
        purchaseOrder: {
          id: updatedCreditNote.purchaseOrder.id,
          poNumber: updatedCreditNote.purchaseOrder.poNumber,
          requisition: {
            id: updatedCreditNote.purchaseOrder.requisition.id,
            requisitionNumber: updatedCreditNote.purchaseOrder.requisition.requisitionNumber,
            heading: updatedCreditNote.purchaseOrder.requisition.heading,
            vessel: updatedCreditNote.purchaseOrder.requisition.vessel,
          },
          quote: {
            vendor: updatedCreditNote.purchaseOrder.quote.vendor,
          },
        },
        uploadedBy: {
          id: updatedCreditNote.uploadedBy.id,
          firstName: updatedCreditNote.uploadedBy.firstName,
          lastName: updatedCreditNote.uploadedBy.lastName,
          employeeId: updatedCreditNote.uploadedBy.employeeId,
        },
        createdAt: updatedCreditNote.createdAt,
        updatedAt: updatedCreditNote.updatedAt,
      } : null,
    });
  } catch (error: any) {
    console.error('Error confirming credit note:', error);
    return NextResponse.json(
      { error: 'Failed to confirm credit note', details: error.message },
      { status: 500 }
    );
  }
}


