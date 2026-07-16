import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { matchKnowledgePacks } from "@/lib/procurement/knowledge-pack-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const partNumber = searchParams.get("partNumber");
    if (!partNumber?.trim()) {
      return NextResponse.json({ packs: [] });
    }

    const packs = await matchKnowledgePacks({
      partNumber,
      drawingNumber: searchParams.get("drawingNumber"),
      itemNumber: searchParams.get("itemNumber"),
      machineryId: searchParams.get("machineryId"),
      impaNumber: searchParams.get("impaNumber"),
      vesselId: searchParams.get("vesselId") || user.vesselId || undefined,
      companyId: searchParams.get("companyId") || undefined,
    });

    return NextResponse.json({ packs });
  } catch (error) {
    console.error("[knowledge-packs match]", error);
    return NextResponse.json({ error: "Failed to match knowledge packs" }, { status: 500 });
  }
}
