import { NextRequest, NextResponse } from "next/server";
import type { KnowledgePackEntityType, KnowledgePackLinkRole } from "@prisma/client";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageKnowledgeLibrary } from "@/lib/procurement/knowledge-pack-governance";
import {
  linkKnowledgePackEntity,
  listKnowledgePackEntityLinks,
  resolveEntityLinkLabels,
} from "@/lib/procurement/knowledge-pack-entity-links";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(_request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageKnowledgeLibrary(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const links = await listKnowledgePackEntityLinks(id);
    const resolved = await resolveEntityLinkLabels(links);

    return NextResponse.json({ links: resolved });
  } catch (error) {
    console.error("[knowledge-packs entity-links GET]", error);
    return NextResponse.json({ error: "Failed to load entity links" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageKnowledgeLibrary(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const entityType = body.entityType as KnowledgePackEntityType;
    const entityId = typeof body.entityId === "string" ? body.entityId : "";
    const linkRole = body.linkRole as KnowledgePackLinkRole | undefined;
    const label = typeof body.label === "string" ? body.label : undefined;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const link = await linkKnowledgePackEntity({
      knowledgePackId: id,
      entityType,
      entityId,
      linkRole,
      label,
      employeeId: user.id,
      request,
    });

    return NextResponse.json({ link });
  } catch (error: any) {
    console.error("[knowledge-packs entity-links POST]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create entity link" },
      { status: 400 }
    );
  }
}
