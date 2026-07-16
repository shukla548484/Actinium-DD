import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { upsertFreightDeclaration } from "@/lib/freight/freight-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requisitionId: z.string().uuid(),
  parentPurchaseOrderId: z.string().uuid(),
  freightVendorId: z.string().uuid(),
  freightAmount: z.number().positive(),
  currency: z.string().min(1).default("USD"),
  chargeBreakdown: z.record(z.number()).optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  freightPort: z.string().optional().nullable(),
  leadTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  freightMode: z.enum(["COMBINED", "SEPARATE"]).optional(),
  submitForApproval: z.boolean().optional(),
});

/** POST /api/purchase/freight/declarations — save or purchaser-approve freight data */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageFreight(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = bodySchema.parse(await request.json());
    const declaration = await upsertFreightDeclaration({
      ...body,
      createdById: user.id,
      source: "PURCHASER",
    });

    return NextResponse.json({ success: true, declaration });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
    }
    console.error("[freight/declarations POST]", error);
    const message = error instanceof Error ? error.message : "Failed to save freight declaration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
