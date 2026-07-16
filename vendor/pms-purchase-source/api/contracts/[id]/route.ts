import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { logActivityFromRequest } from "@/lib/utils/activity-logger";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateContractSchema = z.object({
  contractType: z
    .enum([
      "ANNUAL",
      "QUARTERLY",
      "MONTHLY",
      "ONE_TIME",
      "BLANKET",
      "FRAMEWORK",
      "INVOICE_BASED",
    ])
    .optional(),
  vendorId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  renewalDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  contractValue: z.number().positive().optional(),
  currency: z.string().optional(),
  termsAndConditions: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "PENDING_RENEWAL", "SUSPENDED"]).optional(),
  isGlobal: z.boolean().optional(),
  applicableVesselIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

// GET /api/contracts/[id] - Get contract by ID
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            vendorId: true,
            primaryEmail: true,
            phone: true,
            country: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        contractItems: {
          orderBy: { itemName: "asc" },
        },
        _count: {
          select: {
            requisitions: true,
            // Temporarily exclude purchaseOrders count until migration is run
            // purchaseOrders: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract });
  } catch (error: any) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract", details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - Update contract
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validatedData = updateContractSchema.parse(body);

    // Check if contract exists
    const existingContract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: validatedData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            vendorId: true,
          },
        },
        contractItems: true,
      },
    });

    try {
      await logActivityFromRequest(
        request,
        currentUser.id,
        "CONTRACT_UPDATED",
        `Contract ${contract.contractNumber} updated`,
        { module: "Purchase", page: "/purchase/contracts", metadata: { contractId: contract.id, contractNumber: contract.contractNumber } }
      );
    } catch (logErr) {
      console.error("Error logging contract update activity:", logErr);
    }

    return NextResponse.json({ contract });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Failed to update contract", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - Delete contract
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if contract exists
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            requisitions: true,
            purchaseOrders: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Prevent deletion if contract is in use
    if (contract._count.requisitions > 0 || contract._count.purchaseOrders > 0) {
      return NextResponse.json(
        { error: "Cannot delete contract that is in use" },
        { status: 400 }
      );
    }

    await prisma.contract.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Contract deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Failed to delete contract", details: error.message },
      { status: 500 }
    );
  }
}





