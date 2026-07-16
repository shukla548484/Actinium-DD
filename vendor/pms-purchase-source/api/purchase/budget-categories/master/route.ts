import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";

/** GET /api/purchase/budget-categories/master — global budget category master list */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");

    const where: { isActive?: boolean; level?: number } = { isActive: true };
    if (level === "1") where.level = 1;
    if (level === "2") where.level = 2;

    const categories = await prisma.purchaseBudgetCategoryMaster.findMany({
      where,
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { code: "asc" }],
    });

    return NextResponse.json({ categories, total: categories.length });
  } catch (error: unknown) {
    console.error("Error fetching budget category master:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget categories", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
