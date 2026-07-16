import { NextRequest, NextResponse } from "next/server";
import { getSessionPrincipalFromRequest } from "@/lib/session";
import { getRequisitionSubcategoriesByTypeUncached } from "@/lib/purchase-requisition-reference-data";
import { RequisitionType } from "@/lib/types/requisition";
import { chemicalSubcategoriesForApi } from "@/lib/chemical-requisition-subcategories";

export const dynamic = "force-dynamic";

/** GET /api/purchase/requisition-subcategories?requisitionType=STR */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const principal = await getSessionPrincipalFromRequest(request);
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionType = searchParams.get("requisitionType")?.trim();
    if (!requisitionType) {
      return NextResponse.json({ error: "requisitionType is required" }, { status: 400 });
    }

    const allowedTypes = new Set<string>(Object.values(RequisitionType));
    if (!allowedTypes.has(requisitionType)) {
      return NextResponse.json({ error: "Invalid requisitionType" }, { status: 400 });
    }

    let subcategories;
    try {
      subcategories = await getRequisitionSubcategoriesByTypeUncached(requisitionType);
    } catch (error) {
      console.error("requisition-subcategories lookup:", error);
      if (requisitionType === RequisitionType.CHE) {
        subcategories = chemicalSubcategoriesForApi();
      } else {
        throw error;
      }
    }

    return NextResponse.json(
      { requisitionType, subcategories },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Response-Time-Ms": String(Date.now() - started),
        },
      }
    );
  } catch (error: unknown) {
    console.error("requisition-subcategories GET:", error);
    return NextResponse.json(
      {
        error: "Failed to load sub-categories",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
