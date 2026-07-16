import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const contractItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.number().positive("Unit price must be positive"),
  currency: z.string().default("USD"),
  minQuantity: z.number().positive().optional(),
  maxQuantity: z.number().positive().optional(),
  leadTime: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

// GET /api/contracts/[id]/items - Get contract items
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const items = await prisma.contractItem.findMany({
      where: { contractId: id },
      orderBy: { itemName: "asc" },
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("Error fetching contract items:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract items", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/items - Add contract item
export async function POST(
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
    const validatedData = contractItemSchema.parse(body);

    // Check if contract exists
    const contract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const item = await prisma.contractItem.create({
      data: {
        ...validatedData,
        contractId: id,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating contract item:", error);
    return NextResponse.json(
      { error: "Failed to create contract item", details: error.message },
      { status: 500 }
    );
  }
}







