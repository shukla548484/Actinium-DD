import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  getMachineryAsset,
  parseMachineryAssetFormFields,
  saveMachineryNameplatePhoto,
  softDeleteMachineryAsset,
  updateMachineryAsset,
} from "@/lib/db/vesselMachineryAssets";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

async function resolveVesselForAsset(request: Request, assetId: string) {
  const { searchParams } = new URL(request.url);
  const dryDockProjectId = searchParams.get("dryDockProjectId");
  const vesselIdParam = searchParams.get("vesselId");

  const existing = await prisma.vesselMachineryAsset.findFirst({
    where: { id: assetId, ...notDeleted },
    select: { vesselId: true },
  });
  if (!existing) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return { error: access.response as NextResponse };
    if (access.vesselId !== existing.vesselId) {
      return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
    }
    return { vesselId: existing.vesselId };
  }

  const vesselId = vesselIdParam ?? existing.vesselId;
  const access = await assertVesselInScope(vesselId);
  if (!access.ok) return { error: access.response as NextResponse };
  if (vesselId !== existing.vesselId) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { vesselId: existing.vesselId };
}

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const resolved = await resolveVesselForAsset(request, id);
  if ("error" in resolved) return resolved.error;

  const asset = await getMachineryAsset(resolved.vesselId, id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const resolved = await resolveVesselForAsset(request, id);
  if ("error" in resolved) return resolved.error;

  const contentType = request.headers.get("content-type") ?? "";
  let fields: ReturnType<typeof parseMachineryAssetFormFields>;
  let photoFile: File | null = null;
  let clearPhoto = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    fields = parseMachineryAssetFormFields(form);
    const file = form.get("nameplatePhoto");
    photoFile = file instanceof File && file.size > 0 ? file : null;
    clearPhoto = form.get("clearNameplatePhoto") === "1";
  } else {
    const body = (await request.json()) as Record<string, unknown>;
    fields = parseMachineryAssetFormFields(body);
    clearPhoto = body.clearNameplatePhoto === true || body.clearNameplatePhoto === "1";
  }

  if (fields.name !== undefined && !fields.name.trim()) {
    return NextResponse.json({ error: "Machinery name is required" }, { status: 400 });
  }

  let asset = await updateMachineryAsset(resolved.vesselId, id, {
    ...fields,
    ...(clearPhoto ? { nameplatePhotoUrl: null } : {}),
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (photoFile) {
    const url = await saveMachineryNameplatePhoto(resolved.vesselId, id, photoFile);
    asset = (await updateMachineryAsset(resolved.vesselId, id, { nameplatePhotoUrl: url }))!;
  }

  return NextResponse.json({ asset });
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const resolved = await resolveVesselForAsset(request, id);
  if ("error" in resolved) return resolved.error;

  const ok = await softDeleteMachineryAsset(resolved.vesselId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
