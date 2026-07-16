import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext, sanitizeInput } from '@/lib/api-security';
import prisma from "@/lib/prisma";
import { ensureActivityLogged } from "@/lib/utils/ensure-activity-logged";
import { CreateVendorData, VendorFilters, ServiceType } from "@/lib/types/vendor";
import { resolveMasterCompanyIdForUser } from "@/lib/vendor-company-scope";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

// GET /api/vendors - List vendors with pagination and filters
// SECURITY: Protected by secureApiRoute - requires authentication
const getHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(sanitizeInput(searchParams.get("page")) || "1");
    const limit = parseInt(sanitizeInput(searchParams.get("limit")) || "30");
    const search = sanitizeInput(searchParams.get("search")) || "";
    const country = sanitizeInput(searchParams.get("country")) || "";
    const serviceType = sanitizeInput(searchParams.get("serviceType")) || "";
    const isActive = sanitizeInput(searchParams.get("isActive"));
    const isBlacklisted = sanitizeInput(searchParams.get("isBlacklisted"));
    const rating = sanitizeInput(searchParams.get("rating"));
    const verificationStatus = sanitizeInput(searchParams.get("verificationStatus")) || "";
    const umbrellaCompanyId = sanitizeInput(searchParams.get("umbrellaCompanyId")) || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    const currentUser = context.user;
    const masterCompanyId = await resolveMasterCompanyIdForUser(currentUser?.company);
    const isGlobalAdmin = isAdminEquivalentAccessLevel(currentUser?.designationAccessLevel);

    // Build AND conditions array for proper Prisma query structure
    const andConditions: any[] = [];

    // Company-scoped vendors: each invitation/register row belongs to one master company.
    if (masterCompanyId && !isGlobalAdmin) {
      andConditions.push({ masterCompanyId });
    }

    // Search condition
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { primaryEmail: { contains: search, mode: "insensitive" } },
          { secondaryEmail: { contains: search, mode: "insensitive" } },
          { commonEmail: { contains: search, mode: "insensitive" } },
          { additionalEmail: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Combine all AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (country) {
      where.serviceCountries = {
        has: country
      };
    }

    if (serviceType) {
      where.serviceTypes = {
        has: serviceType
      };
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (isBlacklisted !== null) {
      where.isBlacklisted = isBlacklisted === "true";
    }

    if (rating) {
      where.rating = {
        gte: parseInt(rating)
      };
    }

    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }

    if (umbrellaCompanyId) {
      where.umbrellaCompanyId = umbrellaCompanyId;
    }

    // Get total count and vendors
    // Try to query with masterCompanyId filter, but fallback if column doesn't exist
    let total: number;
    let vendors: any[];
    
    try {
      total = await prisma.vendor.count({ where });
      vendors = await prisma.vendor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });
    } catch (dbError: any) {
      // If error is due to missing column (masterCompanyId or vendorId), retry without those filters
      const errorMessage = dbError.message || '';
      if (errorMessage.includes('masterCompanyId') || errorMessage.includes('master_company_id') || 
          errorMessage.includes('vendorId') || errorMessage.includes('vendor_id') ||
          errorMessage.includes('column') || errorMessage.includes('does not exist')) {
        console.log('[Vendor GET] Column may not exist yet, retrying without masterCompanyId/vendorId filters');
        // Remove masterCompanyId filter and retry
        const fallbackWhere: any = {};
        
        // Copy non-masterCompanyId filters
        if (country) {
          fallbackWhere.serviceCountries = { has: country };
        }
        if (serviceType) {
          fallbackWhere.serviceTypes = { has: serviceType };
        }
        if (isActive !== null) {
          fallbackWhere.isActive = isActive === "true";
        }
        if (isBlacklisted !== null) {
          fallbackWhere.isBlacklisted = isBlacklisted === "true";
        }
        if (rating) {
          fallbackWhere.rating = { gte: parseInt(rating) };
        }
        if (umbrellaCompanyId) {
          fallbackWhere.umbrellaCompanyId = umbrellaCompanyId;
        }
        
        // Add search condition if present
        if (search) {
          fallbackWhere.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { primaryEmail: { contains: search, mode: "insensitive" } },
            { secondaryEmail: { contains: search, mode: "insensitive" } },
            { commonEmail: { contains: search, mode: "insensitive" } },
            { additionalEmail: { contains: search, mode: "insensitive" } },
            { contactPerson: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
          ];
        }
        
        total = await prisma.vendor.count({ where: fallbackWhere });
        vendors = await prisma.vendor.findMany({
          where: fallbackWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });
      } else {
        throw dbError;
      }
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      vendors,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error: any) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch vendors",
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
};

// POST /api/vendors - Create new vendor
// SECURITY: Protected by secureApiRoute - requires authentication
const postHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const {
      name,
      primaryEmail,
      secondaryEmail,
      commonEmail,
      additionalEmail,
      phone,
      address,
      city,
      serviceTypes = [],
      serviceCountries = [],
      rating,
      isBlacklisted = false,
      blacklistReason,
      contactPerson,
      isActive = true,
      umbrellaCompanyId,
    }: CreateVendorData = cleanData;

    // Validate required fields
    if (!name || !primaryEmail || !umbrellaCompanyId || serviceTypes.length === 0 || serviceCountries.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: name, primaryEmail, umbrellaCompanyId, serviceTypes, serviceCountries" },
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

    // Check if vendor with same primary email already exists
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        OR: [
          { primaryEmail },
          { secondaryEmail: primaryEmail },
          { commonEmail: primaryEmail },
          { additionalEmail: primaryEmail }
        ]
      } as any
    });

    if (existingVendor) {
      return NextResponse.json(
        { error: "A vendor with this email already exists" },
        { status: 400 }
      );
    }

    // Ensure serviceCountries is an array and filter out any empty/null values
    const validServiceCountries = Array.isArray(serviceCountries) 
      ? serviceCountries.filter((c: string) => c && c.trim() !== '')
      : [];

    // Log for debugging
    console.log('[Vendor Create] Service Countries received:', serviceCountries);
    console.log('[Vendor Create] Valid Service Countries:', validServiceCountries);
    console.log('[Vendor Create] Service Countries count:', validServiceCountries.length);

    if (validServiceCountries.length === 0) {
      return NextResponse.json(
        { error: "At least one service country is required" },
        { status: 400 }
      );
    }

    // Generate vendor ID (ACT-V-0001 format) - using centralized function
    const { generateNextVendorId } = await import('@/lib/vendor-id-generator');
    const vendorId = await generateNextVendorId();

    // Determine master company based on vessel (if vesselId is provided) or user's company
    let masterCompanyId: string | null = null;
    const vesselId = cleanData.vesselId;
    
    // Use context.user (guaranteed to be authenticated)
    const currentUser = context.user;
    
    // Validate vessel access if vesselId is provided
    if (vesselId && !isAdminEquivalentAccessLevel(context.user.designationAccessLevel)) {
      const hasVesselAccess = context.user.assignedVessels?.some((v: any) => v.vessel?.id === vesselId);
      if (!hasVesselAccess) {
        return NextResponse.json(
          { error: 'Access denied to vessel' },
          { status: 403 }
        );
      }
    }
    
    if (vesselId) {
      // Get vessel with company details
      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        include: {
          company: {
            include: {
              parent: true,
            },
          },
        },
      });

      if (vessel) {
        // If vessel's company is a master company, use it
        // If vessel's company is a sub-company, use its parent (master company)
        if (vessel.company.type === 'MASTER_COMPANY') {
          masterCompanyId = vessel.company.id;
        } else if (vessel.company.parent) {
          masterCompanyId = vessel.company.parent.id;
        } else {
          // Fallback: use vessel's company if no parent found
          masterCompanyId = vessel.company.id;
        }
      }
    }

    // If no vessel provided, try to get master company from user's company
    if (!masterCompanyId && currentUser?.company) {
      const userCompany = await prisma.company.findUnique({
        where: { id: currentUser.company.id },
        include: { parent: true },
      });

      if (userCompany) {
        if (userCompany.type === 'MASTER_COMPANY') {
          masterCompanyId = userCompany.id;
        } else if (userCompany.parent) {
          masterCompanyId = userCompany.parent.id;
        }
      }
    }

    // If still no master company, try to get from umbrellaCompanyId
    if (!masterCompanyId && umbrellaCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: umbrellaCompanyId },
        include: { parent: true },
      });

      if (company) {
        if (company.type === 'MASTER_COMPANY') {
          masterCompanyId = company.id;
        } else if (company.parent) {
          masterCompanyId = company.parent.id;
        }
      }
    }

    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        vendorId,
        name,
        primaryEmail,
        secondaryEmail,
        commonEmail,
        additionalEmail,
        phone,
        address,
        country: validServiceCountries[0] || '',
        city,
        contactPerson,
        serviceTypes,
        serviceCountries: validServiceCountries,
        rating,
        isBlacklisted,
        blacklistReason,
        umbrellaCompanyId,
        masterCompanyId,
        isActive: isActive !== undefined ? isActive : true,
      } as any,
    });

    // Log the created vendor to verify countries were saved
    console.log('[Vendor Create] Vendor created:', {
      vendorId: vendor.vendorId,
      countries: vendor.serviceCountries,
      masterCompanyId: vendor.masterCompanyId,
    });

    await ensureActivityLogged({
      request,
      userId: (context.user as any)?.id,
      activityType: "VENDOR_CREATED",
      activityDescription: `Vendor ${vendor.vendorId} (${vendor.name}) created`,
      module: "Purchase",
      page: "/vendor-management",
      metadata: { vendorId: vendor.id, vendorCode: vendor.vendorId },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
};

// Export with security wrappers
export const GET = secureApiRoute(getHandler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 10, // Require at least level 10 to view vendors
});

export const POST = secureApiRoute(postHandler, {
  requireAuth: true,
  allowedMethods: ['POST'],
  minAccessLevel: 10, // Require at least level 10 to create vendors
});