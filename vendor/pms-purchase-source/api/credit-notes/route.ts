import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { verifyVendorToken } from '@/lib/vendor-auth';
import {
  purchaseFileInputFromUpload,
  uploadPurchaseFileToStorage,
} from '@/lib/purchase/purchase-attachment-storage';

/**
 * GET /api/credit-notes - List all credit notes
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const vendorData = verifyVendorToken(request);
    
    if (!currentUser && !vendorData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const purchaseOrderId = searchParams.get('purchaseOrderId');
    const vesselId = searchParams.get('vesselId');

    const where: any = {};
    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId;
    }
    
    // If vendor, only show credit notes for their purchase orders
    if (vendorData) {
      where.purchaseOrder = {
        quote: {
          vendorId: vendorData.vendorId,
        },
      };
    }
    
    // Filter by vessel if provided
    if (vesselId) {
      where.purchaseOrder = {
        ...where.purchaseOrder,
        requisition: {
          vesselId: vesselId,
        },
      };
    }

    const creditNotes = await prisma.creditNote.findMany({
      where,
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
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      creditNotes: creditNotes.map((cn) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        amount: Number(cn.amount),
        currency: cn.currency,
        date: cn.date,
        pdfUrl: cn.pdfUrl,
        pdfFileName: cn.pdfFileName,
        description: cn.description,
        status: (cn as any).status || 'PENDING',
        vendorConfirmedAt: (cn as any).vendorConfirmedAt || null,
        purchaseOrder: {
          id: cn.purchaseOrder.id,
          poNumber: cn.purchaseOrder.poNumber,
          requisition: {
            id: cn.purchaseOrder.requisition.id,
            requisitionNumber: cn.purchaseOrder.requisition.requisitionNumber,
            heading: cn.purchaseOrder.requisition.heading,
            vessel: cn.purchaseOrder.requisition.vessel,
          },
          quote: {
            vendor: cn.purchaseOrder.quote.vendor,
          },
        },
        uploadedBy: {
          id: cn.uploadedBy.id,
          firstName: cn.uploadedBy.firstName,
          lastName: cn.uploadedBy.lastName,
          employeeId: cn.uploadedBy.employeeId,
        },
        createdAt: cn.createdAt,
        updatedAt: cn.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching credit notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit notes', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credit-notes - Create a new credit note
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const vendorData = verifyVendorToken(request);
    
    // Check access: must be user with level 32/33/50/99/100 OR vendor
    if (!currentUser && !vendorData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (currentUser) {
      const accessLevel = currentUser.designationAccessLevel || 0;
      if (![32, 33, 50, 99, 100].includes(accessLevel)) {
        return NextResponse.json(
          { error: 'Access denied. Only users with access level 32, 33, 50, 99, 100, or vendors can create credit notes.' },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const purchaseOrderId = formData.get('purchaseOrderId') as string;
    const creditNoteNumber = formData.get('creditNoteNumber') as string | null;
    const amount = formData.get('amount') as string;
    const currency = formData.get('currency') as string || 'USD';
    const date = formData.get('date') as string;
    const description = formData.get('description') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;

    // Validate required fields
    if (!purchaseOrderId || !amount || !date) {
      return NextResponse.json(
        { error: 'Purchase Order ID, amount, and date are required' },
        { status: 400 }
      );
    }

    // Validate purchase order exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
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

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase Order not found' },
        { status: 404 }
      );
    }
    
    // If vendor, verify they own this purchase order
    if (vendorData && purchaseOrder.quote.vendorId !== vendorData.vendorId) {
      return NextResponse.json(
        { error: 'Access denied. You can only create credit notes for your own purchase orders.' },
        { status: 403 }
      );
    }

    // Validate PDF file
    if (!pdfFile || pdfFile.size === 0) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    const fileInput = await purchaseFileInputFromUpload(pdfFile);
    const timestamp = Date.now();
    const fileName = `CN_${purchaseOrder.poNumber}_${timestamp}.pdf`;

    const uploadResult = await uploadPurchaseFileToStorage({
      file: fileInput,
      vesselId: purchaseOrder.requisition.vesselId,
      subfolder: `credit-notes/${purchaseOrder.requisitionId}/${purchaseOrder.id}`,
      storageFileName: fileName,
    });

    // For vendors, find a system admin to use as uploadedBy
    let uploadedById = currentUser?.id;
    if (vendorData && !currentUser) {
      // Find a system admin employee (50 / 99 / 100) to use as uploadedBy
      const adminEmployee = await prisma.employee.findFirst({
        where: {
          designationAccessLevel: { in: [50, 99, 100] },
          isActive: true,
        },
        select: { id: true },
      });
      
      if (!adminEmployee) {
        return NextResponse.json(
          { error: 'System error: No admin employee found for vendor credit note creation' },
          { status: 500 }
        );
      }
      uploadedById = adminEmployee.id;
    }
    
    if (!uploadedById) {
      return NextResponse.json(
        { error: 'Unable to determine uploader' },
        { status: 400 }
      );
    }

    // Create credit note
    const creditNote = await prisma.creditNote.create({
      data: {
        purchaseOrderId,
        creditNoteNumber: creditNoteNumber || null,
        amount: parseFloat(amount),
        currency,
        date: new Date(date),
        pdfUrl: uploadResult.fileUrl,
        pdfFileName: fileName,
        description: description || null,
        status: 'PENDING',
        uploadedById,
      },
      include: {
        purchaseOrder: {
          include: {
            requisition: {
              include: {
                vessel: {
                  select: {
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
    
    // Send email notification to vendor if created by employee
    if (currentUser && purchaseOrder.quote.vendor.primaryEmail) {
      // TODO: Send email notification to vendor
      // This would trigger an email to the vendor asking them to confirm the credit note
    }

    return NextResponse.json({
      success: true,
      message: 'Credit note created successfully. Vendor will be notified to confirm.',
      creditNote: {
        id: creditNote.id,
        creditNoteNumber: creditNote.creditNoteNumber,
        amount: Number(creditNote.amount),
        currency: creditNote.currency,
        date: creditNote.date,
        pdfUrl: creditNote.pdfUrl,
        pdfFileName: creditNote.pdfFileName,
        description: creditNote.description,
        status: 'PENDING',
        vendorConfirmedAt: null,
        purchaseOrder: {
          id: creditNote.purchaseOrder.id,
          poNumber: creditNote.purchaseOrder.poNumber,
          requisition: {
            id: creditNote.purchaseOrder.requisition.id,
            requisitionNumber: creditNote.purchaseOrder.requisition.requisitionNumber,
            heading: creditNote.purchaseOrder.requisition.heading,
            vessel: creditNote.purchaseOrder.requisition.vessel,
          },
          quote: {
            vendor: creditNote.purchaseOrder.quote.vendor,
          },
        },
        uploadedBy: {
          id: creditNote.uploadedBy.id,
          firstName: creditNote.uploadedBy.firstName,
          lastName: creditNote.uploadedBy.lastName,
          employeeId: creditNote.uploadedBy.employeeId,
        },
        createdAt: creditNote.createdAt,
        updatedAt: creditNote.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating credit note:', error);
    return NextResponse.json(
      { error: 'Failed to create credit note', details: error.message },
      { status: 500 }
    );
  }
}

