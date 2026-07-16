import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { QuoteStatus } from '@prisma/client';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { hasAtLeastOneQuotedCost } from '@/lib/quote-status-utils';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

/**
 * POST /api/quotes/create-standalone
 * Create a quote for standalone PO with attachment support
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

    // Parse multipart form data
    const formData = await request.formData();
    
    const vesselId = formData.get('vesselId') as string;
    const vendorId = formData.get('vendorId') as string | null;
    const manualVendorName = formData.get('manualVendorName') as string | null;
    const manualVendorEmail = formData.get('manualVendorEmail') as string | null;
    const manualVendorPhone = formData.get('manualVendorPhone') as string | null;
    const manualVendorAddress = formData.get('manualVendorAddress') as string | null;
    const quoteNumber = formData.get('quoteNumber') as string | null;
    const totalAmount = formData.get('totalAmount') as string;
    const currency = formData.get('currency') as string || 'USD';
    const validUntil = formData.get('validUntil') as string | null;
    const notes = formData.get('notes') as string | null;
    const orderDetails = formData.get('orderDetails') as string;
    const attachmentFile = formData.get('attachmentFile') as File | null;

    // Validate required fields
    if (!vesselId || !totalAmount || !orderDetails) {
      return NextResponse.json(
        { error: 'Vessel ID, total amount, and order details are required' },
        { status: 400 }
      );
    }

    // Validate vendor
    if (!vendorId && (!manualVendorName || !manualVendorEmail)) {
      return NextResponse.json(
        { error: 'Either vendor ID or manual vendor name and email are required' },
        { status: 400 }
      );
    }

    // Get or create vendor
    let vendor;
    if (vendorId) {
      vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }
    } else {
      // Create or find vendor by email
      const existingVendor = await prisma.vendor.findFirst({
        where: { primaryEmail: manualVendorEmail! },
      });

      if (existingVendor) {
        vendor = existingVendor;
      } else {
        // Generate vendor ID
        const lastVendor = await prisma.vendor.findFirst({
          orderBy: { vendorId: 'desc' },
        });

        let nextVendorNumber = 1;
        if (lastVendor) {
          const match = lastVendor.vendorId.match(/ACT-V-(\d+)/);
          if (match) {
            nextVendorNumber = parseInt(match[1], 10) + 1;
          }
        }
        // Use centralized vendor ID generator
        const { generateNextVendorId } = await import('@/lib/vendor-id-generator');
        const newVendorId = await generateNextVendorId();

        // Get company for vendor
        const company = await prisma.company.findFirst();
        if (!company) {
          return NextResponse.json({ error: 'No company found. Please set up a company first.' }, { status: 400 });
        }

        vendor = await prisma.vendor.create({
          data: {
            vendorId: newVendorId,
            name: manualVendorName!,
            primaryEmail: manualVendorEmail!,
            phone: manualVendorPhone || null,
            address: manualVendorAddress || null,
            country: 'Unknown',
            isActive: true,
          },
        });
      }
    }

    // Verify vessel exists
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
    });

    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }

    // Create a minimal requisition for standalone PO
    const requisitionType = 'OTR';
    const requisition = await prisma.requisition.create({
      data: {
        requisitionNumber: `STANDALONE-${Date.now()}`,
        heading: 'Standalone Purchase Order',
        description: orderDetails,
        requisitionType: requisitionType,
        vesselId: vesselId,
        createdById: currentUser.id,
        status: 'QUOTE_RECEIVED',
      },
    });

    // Handle attachment upload
    let attachmentUrl: string | null = null;
    if (attachmentFile && attachmentFile.size > 0) {
      try {
        // Validate file size (max 50MB)
        if (attachmentFile.size > 50 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'File size must be less than 50MB' },
            { status: 400 }
          );
        }

        // Convert file to buffer
        const arrayBuffer = await attachmentFile.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Upload to Google Cloud Storage
        const gcs = getGoogleCloudStorageService();
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const sanitizedFileName = attachmentFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const sanitizedVendorName = vendor.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Quote_${sanitizedVendorName}_${timestamp}_${sanitizedFileName}`;

        const uploadResult = await gcs.uploadFile(
          fileBuffer,
          fileName,
          attachmentFile.type || 'application/pdf',
          {
            vesselId: vesselId,
            category: 'purchase',
            subfolder: `standalone-quotes/${requisition.id}`,
          }
        );

        attachmentUrl = uploadResult.publicUrl;
        console.log(`✅ Quote attachment uploaded to GCS: ${attachmentUrl}`);
      } catch (uploadError: any) {
        console.error('Error uploading quote attachment:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload attachment', details: uploadError.message },
          { status: 500 }
        );
      }
    }

    const totalAmountNum = parseFloat(totalAmount);
    const canSetReceived = hasAtLeastOneQuotedCost([{ unitPrice: totalAmountNum, totalPrice: totalAmountNum }]);

    // Create the quote (RECEIVED/APPROVED only when at least one item has non-zero cost)
    const quote = await prisma.vendorQuote.create({
      data: {
        requisitionId: requisition.id,
        vendorId: vendor.id,
        quoteNumber: quoteNumber || null,
        totalAmount: totalAmountNum,
        currency,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || null,
        attachments: attachmentUrl, // Store attachment URL
        status: canSetReceived ? QuoteStatus.APPROVED : QuoteStatus.SENT, // Auto-approve only when quoted
        receivedAt: canSetReceived ? new Date() : null,
        sentAt: new Date(),
        uniqueEmailId: `STANDALONE-${Date.now().toString(36).toUpperCase()}`,
        quotedItems: {
          create: [{
            itemName: 'Standalone Order',
            description: orderDetails,
            quantity: 1,
            unit: 'EA',
            unitPrice: parseFloat(totalAmount),
            totalPrice: parseFloat(totalAmount),
          }],
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
        attachments: quote.attachments,
        receivedAt: quote.receivedAt,
        items: quote.quotedItems,
        requisition: {
          id: requisition.id,
          requisitionNumber: requisition.requisitionNumber,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating standalone quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote', details: error.message },
      { status: 500 }
    );
  }
}


