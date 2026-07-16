import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRequisitionTemplate } from '@/lib/excel-requisition-template';
import { getCurrentUserFromRequest } from '@/lib/session';

/**
 * GET /api/requisitions/[id]/template
 * Download Excel template for requisition
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch requisition with all required data (vessel.company = ship manager company name for branding)
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: true,
        vessel: { include: { company: true } },
        createdBy: true,
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Generate Excel template
    const excelBuffer = await generateRequisitionTemplate({
      requisition: requisition as any,
    });

    // Return Excel file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Quote_Request_Template_${requisition.requisitionNumber}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating requisition template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template', details: error.message },
      { status: 500 }
    );
  }
}
















