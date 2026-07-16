import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext } from '@/lib/api-security';
import { assignVendorIdsToExistingVendors } from '@/lib/vendor-id-generator';
import prisma from '@/lib/prisma';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

// Route segment config - ensures this route is matched before dynamic [id] route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/vendors/assign-ids - Assign vendor IDs to existing vendors that don't have one
 * This is a migration endpoint to update existing vendor records
 * SECURITY: Protected by secureApiRoute - requires admin access
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    // Only allow admins (access level 50) to run this migration
    if (!isAdminEquivalentAccessLevel(context.user.designationAccessLevel)) {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    console.log('🔄 Starting vendor ID assignment migration...');
    
    // First, get a diagnostic report
    const diagnostic = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        vendorId: true,
      },
      take: 10, // Sample first 10 for diagnostics
    });

    console.log('📊 Diagnostic - Sample vendor IDs:', diagnostic.map(v => ({
      name: v.name,
      vendorId: v.vendorId,
      isValid: /^ACT-V-\d+$/i.test(v.vendorId),
    })));

    const result = await assignVendorIdsToExistingVendors();

    console.log('✅ Vendor ID assignment migration completed:', result);

    // Get total count for diagnostic
    const totalVendors = await prisma.vendor.count();
    const vendorsWithValidId = await prisma.vendor.findMany({
      where: {
        vendorId: {
          not: null,
        },
      },
      select: { vendorId: true },
    });
    const validCount = vendorsWithValidId.filter(v => /^ACT-V-\d+$/i.test(v.vendorId || '')).length;

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${result.assigned} vendor IDs assigned, ${result.skipped} skipped, ${result.total} total vendors processed`,
      diagnostic: {
        totalVendors,
        vendorsWithValidFormat: validCount,
        vendorsNeedingUpdate: result.total,
      },
      ...result,
    });
  } catch (error: any) {
    console.error('Error in vendor ID assignment migration:', error);
    return NextResponse.json(
      {
        error: 'Failed to assign vendor IDs',
        details: error.message,
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper
export const POST = secureApiRoute(handler, {
  requireAuth: true,
  allowedMethods: ['POST'],
  minAccessLevel: 50, // Admin only
});
