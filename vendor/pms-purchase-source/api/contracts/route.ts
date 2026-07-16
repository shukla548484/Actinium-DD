import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { logActivityFromRequest } from "@/lib/utils/activity-logger";
import { z } from "zod";

const contractSchema = z.object({
  contractNumber: z.string().min(1, "Contract number is required"),
  contractType: z.enum([
    "ANNUAL",
    "QUARTERLY",
    "MONTHLY",
    "ONE_TIME",
    "BLANKET",
    "FRAMEWORK",
    "INVOICE_BASED",
  ]),
  vendorId: z.string().uuid("Invalid vendor ID"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  renewalDate: z.string().transform((str) => new Date(str)).optional(),
  contractValue: z.number().positive("Contract value must be positive"),
  currency: z.string().default("USD"),
  termsAndConditions: z.string().optional(),
  isGlobal: z.boolean().default(false),
  applicableVesselIds: z.array(z.string().uuid()).default([]),
  notes: z.string().optional(),
});

// GET /api/contracts - List all contracts
export async function GET(request: NextRequest) {
  try {
    // Optional authentication - allow viewing contracts
    const user = await getCurrentUserFromRequest(request).catch(() => null);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");
    const vesselId = searchParams.get("vesselId");
    const search = searchParams.get("search");

    const where: any = {};

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (status) {
      where.status = status;
    }

    // Filter by vessel - check if vessel is in applicableVesselIds array or if contract is global
    if (vesselId) {
      where.OR = [
        { isGlobal: true }, // Global contracts apply to all vessels
        { applicableVesselIds: { has: vesselId } }, // Vessel is in the applicable vessels list
      ];
    }

    if (search) {
      // Combine search with vessel filter if both exist
      if (vesselId) {
        where.AND = [
          {
            OR: [
              { isGlobal: true },
              { applicableVesselIds: { has: vesselId } },
            ],
          },
          {
            OR: [
              { contractNumber: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
        delete where.OR; // Remove the OR we set above, use AND instead
      } else {
        where.OR = [
          { contractNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              vendorId: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          contractItems: true,
          _count: {
            select: {
              requisitions: true,
              // Temporarily exclude purchaseOrders count until migration is run
              // purchaseOrders: true,
            },
          },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return NextResponse.json({
      contracts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching contracts:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch contracts", 
        details: error.message,
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    );
  }
}

// POST /api/contracts - Create new contract
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Parse and validate the contract data
    let validatedData;
    try {
      validatedData = contractSchema.parse(body);
    } catch (validationError: any) {
      if (validationError instanceof z.ZodError) {
        console.error("Validation error:", validationError.errors);
        return NextResponse.json(
          { error: "Validation error", details: validationError.errors },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Check if contract number already exists
    const existingContract = await prisma.contract.findUnique({
      where: { contractNumber: validatedData.contractNumber },
    });

    if (existingContract) {
      return NextResponse.json(
        { error: "Contract number already exists" },
        { status: 400 }
      );
    }

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: validatedData.vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Prepare contract data
    const contractData: any = {
      contractNumber: validatedData.contractNumber,
      contractType: validatedData.contractType,
      vendorId: validatedData.vendorId,
      title: validatedData.title,
      description: validatedData.description || null,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      renewalDate: validatedData.renewalDate || null,
      contractValue: validatedData.contractValue,
      currency: validatedData.currency || "USD",
      termsAndConditions: validatedData.termsAndConditions || null,
      isGlobal: validatedData.isGlobal || false,
      applicableVesselIds: validatedData.applicableVesselIds || [],
      notes: validatedData.notes || null,
      createdById: currentUser.id,
      status: "DRAFT",
    };

    // Create the contract
    const contract = await prisma.contract.create({
      data: contractData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            vendorId: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    try {
      await logActivityFromRequest(
        request,
        currentUser.id,
        "CONTRACT_CREATED",
        `Contract ${contract.contractNumber} created (${contract.title})`,
        { module: "Purchase", page: "/purchase/contracts/create", metadata: { contractId: contract.id, contractNumber: contract.contractNumber, vendorId: contract.vendorId } }
      );
    } catch (logErr) {
      console.error("Error logging contract create activity:", logErr);
    }

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating contract:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    
    // Handle Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "Contract number already exists" },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: "Invalid reference (vendor or user not found)" },
        { status: 400 }
      );
    }

    // Handle table doesn't exist error - but check more carefully
    const errorMessage = error.message?.toLowerCase() || '';
    const isTableMissing = error.code === 'P2021' || 
      (errorMessage.includes('does not exist') && (errorMessage.includes('relation') || errorMessage.includes('table')));
    
    if (isTableMissing) {
      return NextResponse.json(
        { 
          error: "Database table missing", 
          details: "The contracts table does not exist. Please run the database migration: create_contracts_table.sql",
          code: error.code,
          actualError: error.message,
        },
        { status: 500 }
      );
    }

    // Handle column missing errors
    if (error.code === 'P2021' || (errorMessage.includes('column') && errorMessage.includes('does not exist'))) {
      return NextResponse.json(
        { 
          error: "Database schema mismatch", 
          details: `A required column is missing in the contracts table: ${error.message}. Please check your database schema matches the Prisma schema.`,
          code: error.code,
          actualError: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create contract", 
        details: error.message,
        code: error.code,
        meta: error.meta,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}





