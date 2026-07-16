import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { z } from "zod";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetEditForContext, requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { findPurchaseBudgetTypesCompat } from "@/lib/purchase-budget-schema-compat";
import { PURCHASE_BUDGET_SCHEMA_HINT } from "@/lib/purchase-budget-schema-errors";

// Validation schema for budget type creation/update
const budgetTypeSchema = z.object({
  companyId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  level: z.number().int().min(1).max(2).default(2),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  budgetScope: z.enum(["NORMAL", "DRY_DOCK"]).optional(),
});

// GET /api/purchase/budget-types - Get all budget types for a company
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockContext = budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;
    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const companyId = searchParams.get("companyId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      return NextResponse.json({ error: "Invalid companyId format" }, { status: 400 });
    }

    const where: Prisma.PurchaseBudgetTypeWhereInput = {
      companyId,
      budgetScope,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const budgetTypes = await findPurchaseBudgetTypesCompat({
      where,
      budgetScope,
    });

    return NextResponse.json({ budgetTypes });
  } catch (error: unknown) {
    console.error("Error fetching budget types:", error);
    const message = error instanceof Error ? error.message : "Unknown";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "UNKNOWN";
    const missingScope = message.includes("budget_scope");
    const missingTable =
      code === "P2021" ||
      (message.includes("purchase_budget_types") &&
        message.includes("does not exist") &&
        !missingScope);
    return NextResponse.json(
      {
        error: missingTable ? "Purchase budget tables not found" : "Failed to fetch budget types",
        details: message,
        code,
        hint: missingTable
          ? PURCHASE_BUDGET_SCHEMA_HINT
          : missingScope
            ? "Run: psql $DATABASE_URL -f prisma/migrations/apply_purchase_budget_upgrade_after_base.sql"
            : undefined,
      },
      { status: missingTable || missingScope ? 503 : 500 }
    );
  }
}

// POST /api/purchase/budget-types - Create a new budget type
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const validated = budgetTypeSchema.parse(body);
    const budgetScope = parsePurchaseBudgetScope(validated.budgetScope);
    const editDenied = requireBudgetEditForContext(
      user,
      budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (editDenied) return editDenied;

    // Check if budget type with same code already exists for this company
    const existing = await prisma.purchaseBudgetType.findFirst({
      where: {
        companyId: validated.companyId,
        code: validated.code,
        budgetScope,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Budget type with this code already exists for this company" },
        { status: 400 }
      );
    }

    if (validated.level === 2 && validated.parentId) {
      const parent = await prisma.purchaseBudgetType.findFirst({
        where: {
          id: validated.parentId,
          companyId: validated.companyId,
          level: 1,
          budgetScope,
        },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Invalid Level 1 parent category" },
          { status: 400 }
        );
      }
    }

    const budgetType = await prisma.purchaseBudgetType.create({
      data: {
        companyId: validated.companyId,
        parentId: validated.level === 1 ? null : validated.parentId ?? null,
        level: validated.level,
        code: validated.code,
        name: validated.name,
        description: validated.description,
        displayOrder: validated.displayOrder,
        isActive: validated.isActive,
        budgetScope,
        createdById: user.id,
      },
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

    return NextResponse.json({ budgetType }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    // Check if it's a Prisma table doesn't exist error
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('purchase_budget_types')) {
      console.error("Table purchase_budget_types may not exist. Please run the migration:", error.message);
      return NextResponse.json(
        { 
          error: "Database table not found", 
          details: "The purchase_budget_types table does not exist. Please run the database migration.",
          code: error.code || 'TABLE_NOT_FOUND',
          hint: "Run: npx prisma migrate dev or apply the migration SQL manually"
        },
        { status: 500 }
      );
    }
    
    // Check for foreign key constraint errors
    if (error.code === 'P2003') {
      console.error("Foreign key constraint error:", error);
      return NextResponse.json(
        { 
          error: "Invalid reference", 
          details: error.meta?.field_name ? `Invalid ${error.meta.field_name}` : "Invalid company or user reference",
          code: error.code
        },
        { status: 400 }
      );
    }
    
    // Check for unique constraint errors
    if (error.code === 'P2002') {
      console.error("Unique constraint error:", error);
      return NextResponse.json(
        { 
          error: "Duplicate entry", 
          details: error.meta?.target ? `A budget type with this ${error.meta.target.join(' and ')} already exists` : "Budget type already exists",
          code: error.code
        },
        { status: 400 }
      );
    }
    
    console.error("Error creating budget type:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    return NextResponse.json(
      { 
        error: "Failed to create budget type", 
        details: error.message,
        code: error.code || 'UNKNOWN',
        hint: error.meta?.cause || 'Check database connection and table existence'
      },
      { status: 500 }
    );
  }
}
