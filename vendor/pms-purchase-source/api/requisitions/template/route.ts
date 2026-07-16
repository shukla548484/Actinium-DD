import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRequisitionTemplate } from '@/lib/excel-requisition-template';
import { getCurrentUserFromRequest } from '@/lib/session';

/**
 * POST /api/requisitions/template
 * Generate Excel template for requisition creation
 * Body: { vesselId: string, requisitionType: string, heading?: string, description?: string, portOfSupply?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { vesselId, requisitionType, heading, description, portOfSupply } = body;

    if (!vesselId || !requisitionType) {
      return NextResponse.json(
        { error: 'Vessel ID and requisition type are required' },
        { status: 400 }
      );
    }

    // Fetch vessel with company (ship manager company name for Excel branding)
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: {
        id: true,
        name: true,
        code: true,
        imoNumber: true,
        company: { select: { name: true } },
      },
    });

    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }

    // Ensure vessel has required fields
    if (!vessel.name) {
      return NextResponse.json(
        { error: 'Vessel name is missing' },
        { status: 400 }
      );
    }

    // Fetch user with all required fields
    const user = await prisma.employee.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure user has required fields
    if (!user.firstName || !user.lastName) {
      return NextResponse.json(
        { error: 'User name information is incomplete' },
        { status: 400 }
      );
    }

    // Create a temporary requisition object for template generation
    const tempRequisition = {
      id: 'temp',
      requisitionNumber: 'TEMPLATE',
      manualReqNumber: null,
      heading: heading || 'Template Requisition',
      description: description || null,
      portOfSupply: portOfSupply || null,
      requisitionType: requisitionType,
      dateOfCreation: new Date(),
      generationStatus: 'SAVED_AS_DRAFT' as any,
      status: 'NOT_READY' as any,
      portAgentDetails: null,
      isEditable: true,
      createdById: user.id,
      vesselId: vessel.id,
      approvedById: null,
      approvedAt: null,
      returnComments: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [] as any[], // Empty items - vendor will fill in
      vessel: {
        id: vessel.id,
        name: vessel.name,
        code: vessel.code || 'N/A',
        imoNumber: vessel.imoNumber || null,
        company: vessel.company ? { name: vessel.company.name } : undefined,
      },
      createdBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId || null,
      },
    };

    // Generate Excel template
    let excelBuffer: Buffer;
    try {
      excelBuffer = await generateRequisitionTemplate({
        requisition: tempRequisition as any,
      });
    } catch (templateError: any) {
      console.error('Error in generateRequisitionTemplate:', templateError);
      console.error('Template error stack:', templateError.stack);
      return NextResponse.json(
        { 
          error: 'Failed to generate Excel template', 
          details: templateError.message,
          stack: process.env.NODE_ENV === 'development' ? templateError.stack : undefined,
        },
        { status: 500 }
      );
    }

    // Return Excel file
    const vesselCode = vessel.code || 'UNKNOWN';
    const filename = `Quote_Request_Template_${vesselCode}_${requisitionType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating requisition template:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate template', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}





