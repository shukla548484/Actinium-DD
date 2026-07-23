import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  getQuotationRequestById,
  listQuotationRequestsForOffice,
} from "@/lib/db/shipyardQuotation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const detail = await getQuotationRequestById(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ request: detail });
  }

  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? "all";
  const status =
    statusParam === "all" ||
    statusParam === "draft" ||
    statusParam === "sent" ||
    statusParam === "in_progress" ||
    statusParam === "submitted" ||
    statusParam === "withdrawn"
      ? statusParam
      : "all";

  const rows = await listQuotationRequestsForOffice({ vesselId, status });
  return NextResponse.json({ rows });
}
