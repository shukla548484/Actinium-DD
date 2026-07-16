import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generateVendorTemplate } from '@/lib/excel-vendor-utils';

/**
 * GET /api/vendors/template - Download vendor upload template
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate template
    const buffer = await generateVendorTemplate();

    // Return file for download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="vendor-upload-template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Error generating vendor template:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate template',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}








