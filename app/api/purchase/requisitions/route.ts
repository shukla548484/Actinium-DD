import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { createPurchaseRequisition, listPurchaseRequisitions } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/requisitions?vesselId=&status=&q=&take=&skip= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const result = await listPurchaseRequisitions(access.ctx, {
    vesselId: url.searchParams.get("vesselId"),
    status: url.searchParams.get("status"),
    search: url.searchParams.get("q"),
    take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : 50,
    skip: url.searchParams.get("skip") ? Number(url.searchParams.get("skip")) : 0,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

/** POST /api/purchase/requisitions — create draft or submitted requisition */
export async function POST(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const itemsRaw = Array.isArray(b.items) ? b.items : [];

  const result = await createPurchaseRequisition(access.ctx, {
    vesselId: typeof b.vesselId === "string" ? b.vesselId : "",
    heading: typeof b.heading === "string" ? b.heading : "",
    description: typeof b.description === "string" ? b.description : null,
    requisitionType: typeof b.requisitionType === "string" ? b.requisitionType : "SPR",
    portOfSupply: typeof b.portOfSupply === "string" ? b.portOfSupply : null,
    asDraft: Boolean(b.asDraft),
    items: itemsRaw
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => ({
        itemName: typeof i.itemName === "string" ? i.itemName : "",
        quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity) || 1,
        unit: typeof i.unit === "string" ? i.unit : "pcs",
        description: typeof i.description === "string" ? i.description : null,
        partNumber: typeof i.partNumber === "string" ? i.partNumber : null,
      })),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}
