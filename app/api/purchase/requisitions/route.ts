import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { createPurchaseRequisition, listPurchaseRequisitions } from "@/lib/db/purchase";
import { resolveWritableBudgetCode } from "@/lib/purchase/budgetCodes";

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
  const requisitionType = typeof b.requisitionType === "string" ? b.requisitionType : "SPR";
  const subCategoryCode = typeof b.subCategoryCode === "string" ? b.subCategoryCode : null;
  const requisitionPurpose =
    typeof b.requisitionPurpose === "string" ? b.requisitionPurpose : null;
  const explicitBudget = typeof b.budgetCode === "string" ? b.budgetCode : null;

  const resolved = resolveWritableBudgetCode({
    budgetCode: explicitBudget,
    subCategoryCode,
    requisitionType,
    requisitionPurpose,
  });
  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const result = await createPurchaseRequisition(access.ctx, {
    vesselId: typeof b.vesselId === "string" ? b.vesselId : "",
    heading: typeof b.heading === "string" ? b.heading : "",
    description: typeof b.description === "string" ? b.description : null,
    requisitionType,
    portOfSupply: typeof b.portOfSupply === "string" ? b.portOfSupply : null,
    portAgentDetails: typeof b.portAgentDetails === "string" ? b.portAgentDetails : null,
    manualReqNumber: typeof b.manualReqNumber === "string" ? b.manualReqNumber : null,
    requisitionPurpose,
    priority: typeof b.priority === "string" ? b.priority : null,
    subCategoryCode,
    budgetCode: resolved.budgetCode,
    storeLocationId: typeof b.storeLocationId === "string" ? b.storeLocationId : null,
    machineryAssetId: typeof b.machineryAssetId === "string" ? b.machineryAssetId : null,
    spareManualMachineryName:
      typeof b.spareManualMachineryName === "string" ? b.spareManualMachineryName : null,
    asDraft: Boolean(b.asDraft),
    items: itemsRaw
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => ({
        itemName: typeof i.itemName === "string" ? i.itemName : "",
        quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity) || 1,
        unit: typeof i.unit === "string" ? i.unit : "pcs",
        description: typeof i.description === "string" ? i.description : null,
        partNumber: typeof i.partNumber === "string" ? i.partNumber : null,
        remarks: typeof i.remarks === "string" ? i.remarks : null,
        machineryAssetId: typeof i.machineryAssetId === "string" ? i.machineryAssetId : null,
      })),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}
