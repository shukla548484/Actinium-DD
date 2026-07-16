import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { buildSubCategoryBudgetTemplateBuffer } from "@/lib/purchase/excelTemplates";

export const runtime = "nodejs";

/** GET /api/purchase/requisition-subcategories/template */
export async function GET() {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const buffer = buildSubCategoryBudgetTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="requisition-subcategories-budget-template.xlsx"',
    },
  });
}
