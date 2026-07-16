import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext } from '@/lib/api-security';
import prisma from '@/lib/prisma';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

// Route segment config - ensures this route is matched before dynamic [id] route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vendors/check-ids - Check vendor ID status (diagnostic endpoint)
 * SECURITY: Protected by secureApiRoute - requires admin access
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    // Only allow admins (access level 50) to access this diagnostic
    if (!isAdminEquivalentAccessLevel(context.user.designationAccessLevel)) {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all vendors directly from database
    const allVendors = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        vendorId: true,
        primaryEmail: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = allVendors.length;
    
    // Categorize vendors
    const vendorsWithValidId = allVendors.filter(v => 
      v.vendorId && /^ACT-V-\d+$/i.test(v.vendorId)
    );
    
    const vendorsWithInvalidId = allVendors.filter(v => 
      !v.vendorId || v.vendorId.trim() === '' || !/^ACT-V-\d+$/i.test(v.vendorId)
    );

    // More detailed categorization
    const vendorsWithNullId = allVendors.filter(v => !v.vendorId);
    const vendorsWithEmptyId = allVendors.filter(v => v.vendorId && v.vendorId.trim() === '');
    const vendorsWithWrongFormat = allVendors.filter(v => 
      v.vendorId && v.vendorId.trim() !== '' && !/^ACT-V-\d+$/i.test(v.vendorId)
    );

    // Get sample of invalid IDs (more details)
    const invalidSamples = vendorsWithInvalidId.slice(0, 20).map(v => ({
      name: v.name,
      vendorId: v.vendorId || '(null/undefined)',
      id: v.id,
      issue: !v.vendorId ? 'NULL' : v.vendorId.trim() === '' ? 'EMPTY' : 'WRONG_FORMAT',
    }));

    // Get sample of valid IDs
    const validSamples = vendorsWithValidId.slice(0, 10).map(v => ({
      name: v.name,
      vendorId: v.vendorId,
    }));

    // Check for duplicate vendorIds
    const vendorIdMap = new Map<string, number>();
    allVendors.forEach(v => {
      if (v.vendorId) {
        vendorIdMap.set(v.vendorId, (vendorIdMap.get(v.vendorId) || 0) + 1);
      }
    });

    const duplicates = Array.from(vendorIdMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([vendorId, count]) => ({ vendorId, count }));

    // Get highest vendor ID number
    let maxVendorNumber = 0;
    let nextAvailableId = 'ACT-V-0001';
    if (vendorsWithValidId.length > 0) {
      const vendorNumbers = vendorsWithValidId
        .map(v => {
          const match = v.vendorId?.match(/ACT-V-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);

      if (vendorNumbers.length > 0) {
        maxVendorNumber = Math.max(...vendorNumbers);
        nextAvailableId = `ACT-V-${String(maxVendorNumber + 1).padStart(4, '0')}`;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalVendors: total,
        vendorsWithValidId: vendorsWithValidId.length,
        vendorsWithInvalidId: vendorsWithInvalidId.length,
        percentageValid: total > 0 ? Math.round((vendorsWithValidId.length / total) * 100) : 0,
        breakdown: {
          nullIds: vendorsWithNullId.length,
          emptyIds: vendorsWithEmptyId.length,
          wrongFormat: vendorsWithWrongFormat.length,
        },
        duplicates: duplicates.length,
        maxVendorNumber,
        nextAvailableId,
      },
      samples: {
        valid: validSamples,
        invalid: invalidSamples,
      },
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      message: vendorsWithInvalidId.length === 0
        ? '✅ All vendors have valid ACT-V-#### format IDs'
        : `⚠️ ${vendorsWithInvalidId.length} vendor(s) need ID assignment`,
    });
  } catch (error: any) {
    console.error('Error checking vendor IDs:', error);
    return NextResponse.json(
      {
        error: 'Failed to check vendor IDs',
        details: error.message,
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper
export const GET = secureApiRoute(handler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 50, // Admin only
});
