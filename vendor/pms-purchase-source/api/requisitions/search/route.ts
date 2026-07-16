import { NextRequest, NextResponse } from "next/server";
import { getPrismaForRoute } from "@/lib/get-prisma-for-route";
import { getCurrentUserFromRequest } from "@/lib/session";

// GET /api/requisitions/search — Search requisitions (number, heading, part fields).
// Optional `machineryInstanceId` or `manualMachineryName` scopes results and part search
// to items for that machinery only (spares copy-from flow).
export async function GET(request: NextRequest) {
  try {
    const { prisma } = await getPrismaForRoute(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const vesselId = searchParams.get("vesselId") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const requisitionType = searchParams.get("requisitionType")?.trim() || "";
    const machineryInstanceId = searchParams.get("machineryInstanceId")?.trim() || "";
    const manualMachineryName = searchParams.get("manualMachineryName")?.trim() || "";

    const itemMachineryClause: Record<string, unknown> | null =
      machineryInstanceId
        ? { machineryInstanceId: machineryInstanceId }
        : manualMachineryName
          ? {
              manualMachineryName: {
                equals: manualMachineryName,
                mode: "insensitive" as const,
              },
            }
          : null;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (vesselId) {
      where.vesselId = vesselId;
    }

    if (requisitionType) {
      where.requisitionType = requisitionType;
    }

    const andParts: Record<string, unknown>[] = [];

    if (itemMachineryClause) {
      andParts.push({
        items: {
          some: itemMachineryClause,
        },
      });
    }

    if (query && query.trim().length > 0) {
      const q = query.trim();
      const partOr = [
        { partNumber: { contains: q, mode: "insensitive" as const } },
        { partName: { contains: q, mode: "insensitive" as const } },
        { drawingNumber: { contains: q, mode: "insensitive" as const } },
      ];

      if (itemMachineryClause) {
        andParts.push({
          OR: [
            {
              requisitionNumber: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              manualReqNumber: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              heading: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              items: {
                some: {
                  AND: [itemMachineryClause, { OR: partOr }],
                },
              },
            },
          ],
        });
      } else {
        where.OR = [
          {
            requisitionNumber: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
          {
            manualReqNumber: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
          {
            heading: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
          {
            items: {
              some: {
                OR: partOr,
              },
            },
          },
        ];
      }
    }

    if (andParts.length > 0) {
      where.AND = andParts;
    }

    let currentUser;
    try {
      currentUser = await getCurrentUserFromRequest(request);
    } catch (error) {
      console.error("Error getting current user:", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const itemsSelect: {
      where?: Record<string, unknown>;
      take: number;
      orderBy: { createdAt: "asc" };
      select: Record<string, boolean>;
    } = {
      take: 5,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        itemName: true,
        partNumber: true,
        partName: true,
        itemNumber: true,
        drawingNumber: true,
        remarks: true,
        machineryInstanceId: true,
        manualMachineryName: true,
      },
    };
    if (itemMachineryClause) {
      itemsSelect.where = itemMachineryClause;
    }

    const requisitions = await prisma.requisition.findMany({
      where,
      select: {
        id: true,
        requisitionNumber: true,
        manualReqNumber: true,
        heading: true,
        status: true,
        requisitionType: true,
        createdAt: true,
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        items: itemsSelect,
        ...(itemMachineryClause
          ? {
              _count: {
                select: {
                  items: { where: itemMachineryClause },
                },
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    const results = requisitions.map((req: any) => ({
      id: req.id,
      requisitionNumber: req.requisitionNumber,
      displayNumber: req.manualReqNumber || req.requisitionNumber,
      heading: req.heading,
      status: req.status,
      requisitionType: req.requisitionType,
      createdAt: req.createdAt,
      vessel: req.vessel,
      items: req.items || [],
      eligibleItemCount:
        itemMachineryClause && req._count?.items != null
          ? req._count.items
          : (req.items?.length ?? 0),
    }));

    return NextResponse.json({
      requisitions: results,
    });
  } catch (error: any) {
    console.error("Error searching requisitions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search requisitions" },
      { status: 500 }
    );
  }
}
