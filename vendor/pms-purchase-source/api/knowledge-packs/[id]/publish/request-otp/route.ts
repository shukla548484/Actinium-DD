import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  canManageKnowledgeLibrary,
  requestKnowledgePackPublishOtp,
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
    const result = await requestKnowledgePackPublishOtp({
      packId: id,
      employeeId: user.id,
      request,
    });

    return NextResponse.json({
      ok: true,
      expiresAt: result.expiresAt,
      message: "Verification code sent via in-app notification.",
    });
  } catch (error: any) {
    console.error("[knowledge-packs publish request-otp]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to request verification code" },
      { status: 400 }
    );
  }
}
