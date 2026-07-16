import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  canManageKnowledgeLibrary,
  getKnowledgePackDetail,
} from "@/lib/procurement/knowledge-pack-governance";
import { resolveEntityLinkLabels } from "@/lib/procurement/knowledge-pack-entity-links";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageKnowledgeLibrary(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const pack = await getKnowledgePackDetail(id);
    if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [entityLinks, auditEvents] = await Promise.all([
      resolveEntityLinkLabels(pack.entityLinks),
      prisma.platformAuditEvent.findMany({
        where: { entityType: "KnowledgePack", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          createdAt: true,
          actorEmployeeId: true,
          metadata: true,
        },
      }),
    ]);

    return NextResponse.json({ pack, entityLinks, auditEvents });
  } catch (error) {
    console.error("[knowledge-packs GET id]", error);
    return NextResponse.json({ error: "Failed to load knowledge pack" }, { status: 500 });
  }
}
