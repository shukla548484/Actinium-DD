import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { uploadPurchaseItemAttachment } from "@/lib/db/purchase";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

/** POST /api/purchase/requisitions/[id]/items/[itemId]/attachments */
export async function POST(request: Request, context: RouteContext) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const { id: requisitionId, itemId } = await context.params;
  const formData = await request.formData();
  const single = formData.get("file");
  const many = formData.getAll("files");
  const files = [
    ...(single instanceof File ? [single] : []),
    ...many.filter((f): f is File => f instanceof File),
  ];

  if (files.length === 0) {
    return NextResponse.json({ error: "No file(s) provided." }, { status: 400 });
  }

  const attachments = [];
  for (const file of files) {
    const result = await uploadPurchaseItemAttachment(access.ctx, {
      requisitionId,
      itemId,
      file,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    attachments.push(result);
  }

  return NextResponse.json({ attachments }, { status: 201 });
}
