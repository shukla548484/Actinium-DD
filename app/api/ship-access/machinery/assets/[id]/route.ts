import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  getMachineryAsset,
  parseMachineryAssetFormFields,
  saveMachineryNameplatePhoto,
  softDeleteMachineryAsset,
  updateMachineryAsset,
} from "@/lib/db/vesselMachineryAssets";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

async function resolveVesselId(
  request: Request,
  formOrBodyVesselId?: string | null,
): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  return (
    formOrBodyVesselId ??
    searchParams.get("vesselId") ??
    (await getSelectedShipVesselId())
  );
}

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const vesselId = await resolveVesselId(request);
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const asset = await getMachineryAsset(vesselId, id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";
  let vesselIdHint: string | null = null;
  let fields: ReturnType<typeof parseMachineryAssetFormFields>;
  let photoFile: File | null = null;
  let clearPhoto = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    vesselIdHint =
      typeof form.get("vesselId") === "string" ? (form.get("vesselId") as string) : null;
    fields = parseMachineryAssetFormFields(form);
    const file = form.get("nameplatePhoto");
    photoFile = file instanceof File && file.size > 0 ? file : null;
    clearPhoto = form.get("clearNameplatePhoto") === "1";
  } else {
    const body = (await request.json()) as Record<string, unknown>;
    vesselIdHint = typeof body.vesselId === "string" ? body.vesselId : null;
    fields = parseMachineryAssetFormFields(body);
    clearPhoto = body.clearNameplatePhoto === true || body.clearNameplatePhoto === "1";
  }

  const vesselId = await resolveVesselId(request, vesselIdHint);
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  if (fields.name !== undefined && !fields.name.trim()) {
    return NextResponse.json({ error: "Machinery name is required" }, { status: 400 });
  }

  let asset = await updateMachineryAsset(vesselId, id, {
    ...fields,
    ...(clearPhoto ? { nameplatePhotoUrl: null } : {}),
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (photoFile) {
    const url = await saveMachineryNameplatePhoto(vesselId, id, photoFile);
    asset = (await updateMachineryAsset(vesselId, id, { nameplatePhotoUrl: url }))!;
  }

  return NextResponse.json({ asset });
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const vesselId = await resolveVesselId(request);
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const ok = await softDeleteMachineryAsset(vesselId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
