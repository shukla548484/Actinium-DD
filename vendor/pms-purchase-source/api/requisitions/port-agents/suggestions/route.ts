import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

/**
 * GET /api/requisitions/port-agents/suggestions
 * Returns distinct past agents used at a port (from historical requisitions).
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const portId = searchParams.get("portId")?.trim() || "";
    const portName = searchParams.get("portName")?.trim() || "";
    const excludeRequisitionId = searchParams.get("excludeRequisitionId")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    if (!portId && !portName) {
      return NextResponse.json(
        { error: "portId or portName is required" },
        { status: 400 }
      );
    }

    const agents = await prisma.requisitionPortAgent.findMany({
      where: {
        ...(excludeRequisitionId ? { requisitionId: { not: excludeRequisitionId } } : {}),
        ...(portId
          ? { portId }
          : {
              portName: {
                equals: portName,
                mode: "insensitive",
              },
            }),
      },
      select: {
        id: true,
        role: true,
        portId: true,
        portName: true,
        agentName: true,
        companyName: true,
        contactPerson: true,
        email: true,
        phone: true,
        fax: true,
        address: true,
        notes: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const seen = new Set<string>();
    const suggestions = [];
    for (const agent of agents) {
      const key = [
        agent.agentName.toLowerCase(),
        agent.companyName?.toLowerCase() || "",
        agent.email?.toLowerCase() || "",
        agent.phone || "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(agent);
      if (suggestions.length >= limit) break;
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error fetching port agent suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch port agent suggestions" },
      { status: 500 }
    );
  }
}
