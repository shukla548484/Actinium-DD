import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  createMachineryAsset,
  listMachineryAssets,
  parseMachineryAssetFormFields,
  saveMachineryNameplatePhoto,
  updateMachineryAsset,
} from "@/lib/db/vesselMachineryAssets";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

async function resolveVesselIdFromRequest(request: Request, formOrBody?: FormData | Record<string, unknown>) {
  const { searchParams } = new URL(request.url);
  let dryDockProjectId = searchParams.get("dryDockProjectId");
  let vesselId = searchParams.get("vesselId");

  if (formOrBody instanceof FormData) {
    const p = formOrBody.get("dryDockProjectId");
    const v = formOrBody.get("vesselId");
    if (typeof p === "string" && p) dryDockProjectId = p;
    if (typeof v === "string" && v) vesselId = v;
  } else if (formOrBody) {
    if (typeof formOrBody.dryDockProjectId === "string") {
      dryDockProjectId = formOrBody.dryDockProjectId;
    }
    if (typeof formOrBody.vesselId === "string") vesselId = formOrBody.vesselId;
  }

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId: access.vesselId };
  }
  if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId };
  }
  return {
    error: NextResponse.json(
      { error: "dryDockProjectId or vesselId required" },
      { status: 400 },
    ),
  };
}

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const resolved = await resolveVesselIdFromRequest(request);
  if ("error" in resolved) return resolved.error;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") !== "0";
  const assets = await listMachineryAssets(resolved.vesselId, { includeInactive });
  return NextResponse.json({ assets, vesselId: resolved.vesselId });
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const contentType = request.headers.get("content-type") ?? "";
  let fields: ReturnType<typeof parseMachineryAssetFormFields>;
  let photoFile: File | null = null;
  let formOrBody: FormData | Record<string, unknown>;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    formOrBody = form;
    fields = parseMachineryAssetFormFields(form);
    const file = form.get("nameplatePhoto");
    photoFile = file instanceof File && file.size > 0 ? file : null;
  } else {
    const body = (await request.json()) as Record<string, unknown>;
    formOrBody = body;
    fields = parseMachineryAssetFormFields(body);
  }

  const resolved = await resolveVesselIdFromRequest(request, formOrBody);
  if ("error" in resolved) return resolved.error;

  if (!fields.name?.trim()) {
    return NextResponse.json({ error: "Machinery name is required" }, { status: 400 });
  }

  let asset = await createMachineryAsset(resolved.vesselId, {
    ...fields,
    name: fields.name.trim(),
  });
  if (photoFile) {
    const url = await saveMachineryNameplatePhoto(resolved.vesselId, asset.id, photoFile);
    asset = (await updateMachineryAsset(resolved.vesselId, asset.id, {
      nameplatePhotoUrl: url,
    }))!;
  }

  return NextResponse.json({ asset }, { status: 201 });
}
