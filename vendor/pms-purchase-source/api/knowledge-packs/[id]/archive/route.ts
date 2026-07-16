import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  archiveKnowledgePack,
  canManageKnowledgeLibrary,
} from "@/lib/procurement/knowledge-pack-governance";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageKnowledgeLibrary(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const pack = await archiveKnowledgePack({
      packId: id,
      employeeId: user.id,
      request,
    });

    return NextResponse.json({ pack });
  } catch (error: any) {
    console.error("[knowledge-packs archive]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to archive knowledge pack" },
      { status: 400 }
    );
  }
}
