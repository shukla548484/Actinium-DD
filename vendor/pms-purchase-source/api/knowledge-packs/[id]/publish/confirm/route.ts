import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  canManageKnowledgeLibrary,
  confirmKnowledgePackPublishOtp,
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
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";

    const pack = await confirmKnowledgePackPublishOtp({
      packId: id,
      employeeId: user.id,
      code,
      request,
    });

    return NextResponse.json({ pack });
  } catch (error: any) {
    console.error("[knowledge-packs publish confirm]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to confirm publish" },
      { status: 400 }
    );
  }
}
