import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { ensureActivityLogged } from "@/lib/utils/ensure-activity-logged";
import { UpdateVendorData, RateVendorData, BlacklistVendorData } from "@/lib/types/vendor";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/vendors/[id] - Get single vendor
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    
    // Reject special routes that should be handled by specific route files
    const specialRoutes = ['assign-ids', 'bulk-upload', 'template', 'export', 'check-ids'];
    if (specialRoutes.includes(id)) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        quotes: {
          include: {
            requisition: {
              select: {
                requisitionNumber: true,
                heading: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10, // Get last 10 quotes
        },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor" },
      { status: 500 }
    );
  }
}

// PUT /api/vendors/[id] - Update vendor
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    
    // Reject special routes that should be handled by specific route files
    const specialRoutes = ['assign-ids', 'bulk-upload', 'template', 'export', 'check-ids'];
    if (specialRoutes.includes(id)) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }
    const body = await request.json();
    const {
      name,
      primaryEmail,
      secondaryEmail,
      commonEmail,
      additionalEmail,
      phone,
      address,
      serviceTypes,
      serviceCountries,
      rating,
      isBlacklisted,
      blacklistReason,
      contactPerson,
      isActive,
    }: UpdateVendorData = body;

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

    // Validate required fields
    if (!name || !primaryEmail) {
      return NextResponse.json(
        { error: "Missing required fields: name, primaryEmail" },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if another vendor with same email already exists (excluding current vendor)
    const existingVendorWithEmail = await prisma.vendor.findFirst({
      where: { 
        primaryEmail: primaryEmail,
        id: { not: id }
      }
    });

    if (existingVendorWithEmail) {
      return NextResponse.json(
        { error: "A vendor with this email already exists" },
        { status: 400 }
      );
    }

    // Ensure serviceCountries is an array and filter out any empty/null values
    const validServiceCountries = Array.isArray(serviceCountries) 
      ? serviceCountries.filter((c: string) => c && c.trim() !== '')
      : (existingVendor.serviceCountries || []);

    // Ensure serviceTypes is an array
    const validServiceTypes = Array.isArray(serviceTypes) 
      ? serviceTypes.filter((t: string) => t && t.trim() !== '')
      : (existingVendor.serviceTypes || []);

    // Log for debugging
    console.log('[Vendor Update] Service Countries received:', serviceCountries);
    console.log('[Vendor Update] Service Countries type:', typeof serviceCountries, Array.isArray(serviceCountries));
    console.log('[Vendor Update] Valid Service Countries:', validServiceCountries);
    console.log('[Vendor Update] Service Countries count:', validServiceCountries.length);

    // Update vendor
    const updateData: any = {
      name,
      primaryEmail,
      secondaryEmail,
      commonEmail,
      additionalEmail,
      phone,
      address,
      country: validServiceCountries[0] || existingVendor.country,
      contactPerson,
      serviceTypes: validServiceTypes.length > 0 ? validServiceTypes : existingVendor.serviceTypes,
      serviceCountries: validServiceCountries.length > 0 ? validServiceCountries : existingVendor.serviceCountries,
      rating: rating !== undefined ? rating : existingVendor.rating,
      isBlacklisted: isBlacklisted !== undefined ? isBlacklisted : existingVendor.isBlacklisted,
      blacklistReason: blacklistReason !== undefined ? blacklistReason : existingVendor.blacklistReason,
      isActive: isActive !== undefined ? isActive : existingVendor.isActive,
    };

    // Ensure serviceCountries is always an array
    if (!Array.isArray(updateData.serviceCountries)) {
      updateData.serviceCountries = [];
    }

    // Ensure serviceTypes is always an array
    if (!Array.isArray(updateData.serviceTypes)) {
      updateData.serviceTypes = [];
    }

    console.log('[Vendor Update] Final update data:', {
      ...updateData,
      serviceCountries: updateData.serviceCountries,
      serviceCountriesType: Array.isArray(updateData.serviceCountries),
    });

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: updateData,
    });

    // Log the updated vendor to verify countries were saved
    console.log('[Vendor Update] Vendor updated with countries:', updatedVendor.serviceCountries);

    const currentUser = await getCurrentUserFromRequest(request);
    if (currentUser) {
      await ensureActivityLogged({
        request,
        userId: (currentUser as any).id,
        activityType: "VENDOR_UPDATED",
        activityDescription: `Vendor ${updatedVendor.vendorId} (${updatedVendor.name}) updated`,
        module: "Purchase",
        page: "/vendor-management",
        metadata: { vendorId: updatedVendor.id, vendorCode: updatedVendor.vendorId },
      });
    }

    return NextResponse.json(updatedVendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update vendor";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/vendors/[id] - Delete vendor
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    
    // Reject special routes that should be handled by specific route files
    const specialRoutes = ['assign-ids', 'bulk-upload', 'template', 'export', 'check-ids'];
    if (specialRoutes.includes(id)) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    // Check if vendor exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        quotes: {
          select: { id: true }
        }
      }
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Check if vendor has any quotes
    if (existingVendor.quotes.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete vendor with existing quotes. Please remove all quotes first or deactivate the vendor instead." 
        },
        { status: 400 }
      );
    }

    // Delete vendor
    await prisma.vendor.delete({
      where: { id },
    });

    return NextResponse.json({ 
      message: "Vendor deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { error: "Failed to delete vendor" },
      { status: 500 }
    );
  }
}