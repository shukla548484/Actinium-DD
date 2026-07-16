import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  requirePurchaseBudgetEdit,
  requirePurchaseBudgetView,
} from "@/lib/purchase-budget-access";
import { z } from "zod";

const updateBudgetTypeSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid().optional().nullable(),
  level: z.number().int().min(1).max(2).optional(),
});

// GET /api/purchase/budget-types/[id] - Get a specific budget type
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const viewDenied = requirePurchaseBudgetView(user.designationAccessLevel);
    if (viewDenied) return viewDenied;

    const budgetType = await prisma.purchaseBudgetType.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!budgetType) {
      return NextResponse.json({ error: "Budget type not found" }, { status: 404 });
    }

    return NextResponse.json({ budgetType });
  } catch (error: any) {
    console.error("Error fetching budget type:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget type", details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/purchase/budget-types/[id] - Update a budget type
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const editDenied = requirePurchaseBudgetEdit(user.designationAccessLevel);
    if (editDenied) return editDenied;

    const body = await request.json();
    const validated = updateBudgetTypeSchema.parse(body);

    const existing = await prisma.purchaseBudgetType.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Budget type not found" }, { status: 404 });
    }

    // If code is being updated, check for uniqueness
    if (validated.code && validated.code !== existing.code) {
      const codeExists = await prisma.purchaseBudgetType.findFirst({
        where: {
          companyId: existing.companyId,
          code: validated.code,
        },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: "Budget type with this code already exists for this company" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { ...validated };
    if (validated.level === 1) {
      updateData.parentId = null;
    } else if (validated.parentId) {
      const parent = await prisma.purchaseBudgetType.findFirst({
        where: {
          id: validated.parentId,
          companyId: existing.companyId,
          level: 1,
        },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Invalid Level 1 parent category" },
          { status: 400 }
        );
      }
    }

    const budgetType = await prisma.purchaseBudgetType.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ budgetType });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating budget type:", error);
    return NextResponse.json(
      { error: "Failed to update budget type", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase/budget-types/[id] - Delete a budget type
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const editDenied = requirePurchaseBudgetEdit(user.designationAccessLevel);
    if (editDenied) return editDenied;

    const budgetType = await prisma.purchaseBudgetType.findUnique({
      where: { id: params.id },
      include: {
        budgets: {
          take: 1,
        },
      },
    });

    if (!budgetType) {
      return NextResponse.json({ error: "Budget type not found" }, { status: 404 });
    }

    // Check if budget type is being used in any budgets
    if (budgetType.budgets.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete budget type that is being used in budgets. Please delete or update the budgets first." },
        { status: 400 }
      );
    }

    await prisma.purchaseBudgetType.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Budget type deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting budget type:", error);
    return NextResponse.json(
      { error: "Failed to delete budget type", details: error.message },
      { status: 500 }
    );
  }
}
