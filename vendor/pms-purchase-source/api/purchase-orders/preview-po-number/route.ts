import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generatePONumber } from '@/lib/services/po-number-generator';
import { z } from 'zod';

const previewPONumberSchema = z.object({
  vesselId: z.string().uuid(),
  requisitionType: z.string().optional().default('OTR'),
});

/**
 * GET /api/purchase-orders/preview-po-number
 * Preview the PO number that will be assigned
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');
    const requisitionType = searchParams.get('requisitionType') || 'OTR';

    if (!vesselId) {
      return NextResponse.json({ error: 'Vessel ID is required' }, { status: 400 });
    }

    // Validate input
    const validatedData = previewPONumberSchema.parse({
      vesselId,
      requisitionType,
    });

    // Generate PO number (this will check availability and increment if needed)
    const poNumber = await generatePONumber(validatedData.vesselId, validatedData.requisitionType);

    return NextResponse.json({
      success: true,
      poNumber,
    });
  } catch (error: any) {
    console.error('Error previewing PO number:', error);
    return NextResponse.json(
      {
        error: 'Failed to preview PO number',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}


