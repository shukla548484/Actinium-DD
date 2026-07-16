import { NextRequest, NextResponse } from "next/server";
import type { KnowledgePackStatus } from "@prisma/client";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  canManageKnowledgeLibrary,
  getKnowledgeLibraryStats,
  listKnowledgePacksForOffice,
} from "@/lib/procurement/knowledge-pack-governance";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageKnowledgeLibrary(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as KnowledgePackStatus | null;
    const partNumber = searchParams.get("partNumber") || undefined;
    const vesselId = searchParams.get("vesselId") || undefined;
    const vendorPublishedParam = searchParams.get("vendorPublished");
    const vendorPublished =
      vendorPublishedParam === "true"
        ? true
        : vendorPublishedParam === "false"
          ? false
          : undefined;
    const includeStats = searchParams.get("stats") === "1";

    const [packs, stats] = await Promise.all([
      listKnowledgePacksForOffice({
        status: status || undefined,
        partNumber,
        vesselId,
        vendorPublished,
      }),
      includeStats ? getKnowledgeLibraryStats() : Promise.resolve(null),
    ]);

    return NextResponse.json({ packs, stats });
  } catch (error) {
    console.error("[knowledge-packs GET]", error);
    return NextResponse.json({ error: "Failed to list knowledge packs" }, { status: 500 });
  }
}
