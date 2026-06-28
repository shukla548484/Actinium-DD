import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { deleteMasterSpecLine, getMasterSpecLine, updateMasterSpecLine } from "@/lib/db/masterCatalog";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as {
    bucket?: string;
    lineCode?: string | null;
    description?: string;
    descriptionZh?: string | null;
    descriptionJa?: string | null;
    unit?: string | null;
    defaultQty?: number | null;
    calcRule?: string;
    scopeDays?: number | null;
    scopeAreaM2?: number | null;
    scopeNotes?: string | null;
    referenceUnitRate?: number | null;
    maxDiscountPct?: number | null;
    allowDiscount?: boolean;
    isOptional?: boolean;
    isActive?: boolean;
  };

  const line = await updateMasterSpecLine(id, {
    bucket: body.bucket,
    lineCode: body.lineCode,
    description: body.description,
    descriptions:
      body.descriptionZh !== undefined || body.descriptionJa !== undefined
        ? {
            en: body.description ?? "",
            zh: body.descriptionZh ?? null,
            ja: body.descriptionJa ?? null,
          }
        : undefined,
    unit: body.unit,
    defaultQty: body.defaultQty,
    scopeDays: body.scopeDays,
    scopeAreaM2: body.scopeAreaM2,
    scopeNotes: body.scopeNotes,
    referenceUnitRate: body.referenceUnitRate,
    maxDiscountPct: body.maxDiscountPct,
    allowDiscount: body.allowDiscount,
    isOptional: body.isOptional,
    calcRule: body.calcRule,
    isActive: body.isActive,
  });

  if (!line) {
    return NextResponse.json({ error: "Line not found." }, { status: 404 });
  }

  return NextResponse.json({ line });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getMasterSpecLine(id);
  if (!existing) {
    return NextResponse.json({ error: "Line not found." }, { status: 404 });
  }

  const ok = await deleteMasterSpecLine(id);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
