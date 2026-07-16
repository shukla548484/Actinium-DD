import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  promoteClarificationToKnowledgePack,
  previewPromoteClarificationDuplicates,
} from "@/lib/procurement/knowledge-pack-service";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(_request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManagePurchaseClarifications(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const { similarPacks } = await previewPromoteClarificationDuplicates(id);
    return NextResponse.json({ similarPacks });
  } catch (error) {
    console.error("[promote clarification preview]", error);
    return NextResponse.json({ error: "Failed to preview duplicates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManagePurchaseClarifications(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const pack = await promoteClarificationToKnowledgePack({
      clarificationId: id,
      employeeId: user.id,
      title: body.title,
      request,
    });

    return NextResponse.json({ knowledgePack: pack });
  } catch (error: any) {
    console.error("[promote clarification]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to promote to knowledge pack" },
      { status: 400 }
    );
  }
}
