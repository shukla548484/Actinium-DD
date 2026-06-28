import { NextResponse } from "next/server";
import { createSpecLine, deleteSpecLine, getProject, updateSpecLine } from "@/lib/db/index";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    lineId?: string;
    description?: string;
    descriptionZh?: string | null;
    descriptionJa?: string | null;
    unit?: string | null;
    defaultQty?: number | null;
    scopeDays?: number | null;
    scopeAreaM2?: number | null;
    scopeNotes?: string | null;
    ownerLocked?: boolean;
    allowDiscount?: boolean;
    maxDiscountPct?: number | null;
    referenceUnitRate?: number | null;
    isOptional?: boolean;
  };

  if (!body.lineId) {
    return NextResponse.json({ error: "lineId is required." }, { status: 400 });
  }

  const line = await updateSpecLine(body.lineId, {
    description: body.description,
    descriptions:
      body.descriptionZh !== undefined || body.descriptionJa !== undefined
        ? {
            en: body.description ?? "",
            zh: body.descriptionZh ?? null,
            ja: body.descriptionJa ?? null,
          }
        : undefined,
    unit: body.unit ?? undefined,
    defaultQty: body.defaultQty,
    scopeDays: body.scopeDays,
    scopeAreaM2: body.scopeAreaM2,
    scopeNotes: body.scopeNotes,
    ownerLocked: body.ownerLocked,
    allowDiscount: body.allowDiscount,
    maxDiscountPct: body.maxDiscountPct,
    referenceUnitRate: body.referenceUnitRate,
    isOptional: body.isOptional,
  });

  if (!line || line.projectId !== projectId) {
    return NextResponse.json({ error: "Spec line not found." }, { status: 404 });
  }

  return NextResponse.json({ line });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

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

  const line = await createSpecLine({
    projectId,
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get("lineId");

  if (!lineId) {
    return NextResponse.json({ error: "lineId query param is required." }, { status: 400 });
  }

  const ok = await deleteSpecLine(lineId);
  if (!ok) {
    return NextResponse.json({ error: "Spec line not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
