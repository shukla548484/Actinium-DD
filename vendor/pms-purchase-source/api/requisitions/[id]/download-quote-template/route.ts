import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateQuoteRequestExcelTemplate } from "@/lib/excel-quote-template";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/requisitions/[id]/download-quote-template - Download quote request template
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const { searchParams } = new URL(request.url);
    const portOfSupply = searchParams.get("portOfSupply");

    // Check if requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: true,
        vessel: {
          include: {
            company: true,
          },
        },
        createdBy: true,
      },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Validate required data
    const errors: string[] = [];

    if (!requisition.items || requisition.items.length === 0) {
      errors.push("Requisition must have at least one item");
    }

    if (!requisition.vessel) {
      errors.push("Vessel information is missing");
    }

    if (!portOfSupply && !requisition.portOfSupply) {
      errors.push("Port of Supply is required. Please enter it in the form before downloading the template.");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Missing required data", details: errors },
        { status: 400 }
      );
    }

    // Generate Excel template
    const excelBuffer = await generateQuoteRequestExcelTemplate({
      requisition: requisition as any,
      vendorEmail: "template@example.com", // Placeholder for template
      vendorName: "Vendor Name", // Placeholder for template
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      portOfSupply: portOfSupply || requisition.portOfSupply || undefined,
      customMessage: undefined,
    });

    // Return Excel file as download
    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Quote_Request_Template_${requisition.requisitionNumber}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error generating quote template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}

