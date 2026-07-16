import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parseBudgetTypeExcel } from "@/lib/excel-budget-type-utils";
import { importPurchaseBudgetTypes } from "@/lib/purchase-budget-type-import";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetEditForContext } from "@/lib/drydock-budget-access";

/**
 * POST /api/purchase/budget-types/import - Import budget categories from Excel file
 * Body: FormData with "file" (Excel) and "companyId" (UUID)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;
    const budgetScope = parsePurchaseBudgetScope(
      (formData.get("budgetScope") as string | null) ?? undefined
    );
    const editDenied = requireBudgetEditForContext(
      user,
      budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (editDenied) return editDenied;

    if (!file || !companyId?.trim()) {
      return NextResponse.json(
        { error: "Missing file or companyId" },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId.trim())) {
      return NextResponse.json(
        { error: "Invalid companyId format" },
        { status: 400 }
      );
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !/\.(xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel (.xlsx or .xls) file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseBudgetTypeExcel(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid budget category rows found. Use columns: Level 1 Code, Level 1 Category, Level 2 Code, Level 2 Category, Active (Y/N).",
        },
        { status: 400 }
      );
    }

    const result = await importPurchaseBudgetTypes(
      companyId.trim(),
      rows,
      user.id,
      budgetScope
    );

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      total: rows.length,
      budgetScope,
    });
  } catch (error: unknown) {
    console.error("Error importing budget types:", error);
    return NextResponse.json(
      {
        error: "Failed to import budget types",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
