import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  linkKnowledgePackToRequisitionItem,
  getVendorKnowledgeUrlForItem,
} from "@/lib/procurement/knowledge-pack-service";

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(_request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { itemId } = await context.params;
    const links = await getVendorKnowledgeUrlForItem(itemId);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("[knowledge links GET]", error);
    return NextResponse.json({ error: "Failed to load links" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { itemId } = await context.params;
    const body = await request.json();
    if (!body.knowledgePackId) {
      return NextResponse.json({ error: "knowledgePackId is required" }, { status: 400 });
    }

    const link = await linkKnowledgePackToRequisitionItem({
      requisitionItemId: itemId,
      knowledgePackId: body.knowledgePackId,
      employeeId: user.id,
      includeInVendorPack: body.includeInVendorPack !== false,
      request,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error: any) {
    console.error("[knowledge links POST]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to link knowledge pack" },
      { status: 400 }
    );
  }
}
