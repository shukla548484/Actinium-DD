import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { RateVendorData } from "@/lib/types/vendor";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PUT /api/vendors/[id]/rate - Rate vendor
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const body = await request.json();
    const { rating }: RateVendorData = body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if vendor exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Note: Rating functionality is not implemented in the database schema
    // This endpoint is kept for API compatibility but doesn't persist ratings
    
    return NextResponse.json({
      message: "Rating functionality not implemented",
      vendor: { id, rating }
    });
  } catch (error) {
    console.error("Error rating vendor:", error);
    return NextResponse.json(
      { error: "Failed to rate vendor" },
      { status: 500 }
    );
  }
}