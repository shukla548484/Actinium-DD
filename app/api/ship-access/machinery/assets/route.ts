import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  createMachineryAsset,
  listMachineryAssets,
  parseMachineryAssetFormFields,
  saveMachineryNameplatePhoto,
  updateMachineryAsset,
} from "@/lib/db/vesselMachineryAssets";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId") ?? (await getSelectedShipVesselId());
    if (!vesselId) {
      return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    const includeInactive = searchParams.get("includeInactive") === "1";
    const assets = await listMachineryAssets(vesselId, { includeInactive });
    return NextResponse.json({ assets });
  } catch (err) {
    console.error("[ship-access/machinery/assets] GET failed", err);
    return NextResponse.json({ error: "Failed to load machinery assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const contentType = request.headers.get("content-type") ?? "";
    let vesselId: string | null = null;
    let fields: ReturnType<typeof parseMachineryAssetFormFields>;
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      vesselId =
        (typeof form.get("vesselId") === "string" ? (form.get("vesselId") as string) : null) ??
        (await getSelectedShipVesselId());
      fields = parseMachineryAssetFormFields(form);
      const file = form.get("nameplatePhoto");
      photoFile = file instanceof File && file.size > 0 ? file : null;
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      vesselId =
        (typeof body.vesselId === "string" ? body.vesselId : null) ??
        (await getSelectedShipVesselId());
      fields = parseMachineryAssetFormFields(body);
    }

    if (!vesselId) {
      return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
    }
    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    if (!fields.name?.trim()) {
      return NextResponse.json({ error: "Machinery name is required" }, { status: 400 });
    }

    let asset = await createMachineryAsset(vesselId, {
      ...fields,
      name: fields.name.trim(),
    });
    if (photoFile) {
      const url = await saveMachineryNameplatePhoto(vesselId, asset.id, photoFile);
      asset = (await updateMachineryAsset(vesselId, asset.id, { nameplatePhotoUrl: url }))!;
    }

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err) {
    console.error("[ship-access/machinery/assets] POST failed", err);
    return NextResponse.json({ error: "Failed to create machinery asset" }, { status: 500 });
  }
}
