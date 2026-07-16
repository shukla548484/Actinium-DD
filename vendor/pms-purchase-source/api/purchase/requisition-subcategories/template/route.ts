import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { generateRequisitionSubCategoryTemplate } from "@/lib/excel-requisition-subcategory-utils";

/** GET — download Excel: requisition type, sub category, Level 1 / Level 2 budget (from master). */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buffer = await generateRequisitionSubCategoryTemplate();
    const filename = `requisition-subcategories-budget-template.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("requisition-subcategories template:", error);
    return NextResponse.json(
      { error: "Failed to generate template", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
