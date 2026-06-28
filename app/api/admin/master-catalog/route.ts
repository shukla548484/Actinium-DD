import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  createMasterSpecLine,
  ensureMasterCatalogSeeded,
  listMasterSpecLines,
} from "@/lib/db/masterCatalog";
import { STANDARD_DOCKING_CATEGORIES } from "@/lib/tender/categories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  await ensureMasterCatalogSeeded();

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket") ?? undefined;

  const lines = await listMasterSpecLines({ bucket, activeOnly: false });

  return NextResponse.json({ lines, categories: STANDARD_DOCKING_CATEGORIES });
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const body = (await request.json()) as {
    bucket: string;
    lineCode?: string;
    description: string;
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
  };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required." }, { status: 400 });
  }
  if (!body.bucket?.trim()) {
    return NextResponse.json({ error: "bucket is required." }, { status: 400 });
  }

  const line = await createMasterSpecLine({
    bucket: body.bucket,
    lineCode: body.lineCode,
    description: body.description.trim(),
    descriptionZh: body.descriptionZh,
    descriptionJa: body.descriptionJa,
    unit: body.unit,
    defaultQty: body.defaultQty,
    calcRule: body.calcRule,
    scopeDays: body.scopeDays,
    scopeAreaM2: body.scopeAreaM2,
    scopeNotes: body.scopeNotes,
    referenceUnitRate: body.referenceUnitRate,
    maxDiscountPct: body.maxDiscountPct,
    allowDiscount: body.allowDiscount,
    isOptional: body.isOptional,
  });

  return NextResponse.json({ line }, { status: 201 });
}
