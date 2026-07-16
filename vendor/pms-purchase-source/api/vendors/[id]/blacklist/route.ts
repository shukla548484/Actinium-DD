import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { BlacklistVendorData } from "@/lib/types/vendor";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PUT /api/vendors/[id]/blacklist - Blacklist/unblacklist vendor
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const body = await request.json();
    const { isBlacklisted, blacklistReason }: BlacklistVendorData = body;

    // Validate input
    if (typeof isBlacklisted !== 'boolean') {
      return NextResponse.json(
        { error: "isBlacklisted must be a boolean value" },
        { status: 400 }
      );
    }

    // If blacklisting, reason should be provided
    if (isBlacklisted && !blacklistReason?.trim()) {
      return NextResponse.json(
        { error: "Blacklist reason is required when blacklisting a vendor" },
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

    // Update vendor blacklist status
    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: {
        isBlacklisted,
        blacklistReason: isBlacklisted ? blacklistReason : null,
        // Automatically deactivate if blacklisted
        isActive: isBlacklisted ? false : existingVendor.isActive,
      },
    });

    return NextResponse.json({
      message: isBlacklisted 
        ? "Vendor blacklisted successfully" 
        : "Vendor removed from blacklist successfully",
      vendor: updatedVendor
    });
  } catch (error) {
    console.error("Error updating vendor blacklist status:", error);
    return NextResponse.json(
      { error: "Failed to update vendor blacklist status" },
      { status: 500 }
    );
  }
}