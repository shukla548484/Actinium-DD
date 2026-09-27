import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { createMachineryAssetsBatch } from "@/lib/db/vesselMachineryAssets";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type BatchItem = {
  name?: unknown;
  department?: unknown;
  maker?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  units?: unknown;
  location?: unknown;
  notes?: unknown;
  isActive?: unknown;
};

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export async function POST(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const body = (await request.json()) as {
      vesselId?: string;
      rows?: BatchItem[];
    };

    const vesselId = body.vesselId ?? (await getSelectedShipVesselId());
    if (!vesselId) {
      return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to register" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 rows per batch" }, { status: 400 });
    }

    const inputs = rows.map((row) => {
      const isActiveRaw = row.isActive;
      let isActive = true;
      if (typeof isActiveRaw === "boolean") isActive = isActiveRaw;
      else if (typeof isActiveRaw === "string") {
        isActive = !["false", "0", "inactive", "deactive", "deactivated"].includes(
          isActiveRaw.trim().toLowerCase(),
        );
      }
      return {
        name: asString(row.name).trim(),
        department: asString(row.department).trim() || "Machinery",
        maker: asString(row.maker).trim() || null,
        model: asString(row.model).trim() || null,
        serialNumber: asString(row.serialNumber).trim() || null,
        units: asString(row.units).trim() || null,
        location: asString(row.location).trim() || null,
        notes: asString(row.notes).trim() || null,
        isActive,
      };
    });

    const missing = inputs.findIndex((r) => !r.name);
    if (missing >= 0) {
      return NextResponse.json(
        { error: `Row ${missing + 1}: Machinery name is required` },
        { status: 400 },
      );
    }

    const result = await createMachineryAssetsBatch(vesselId, inputs);
    return NextResponse.json({
      created: result.created,
      failed: result.failed,
      message: `Registered ${result.created.length} of ${inputs.length} machinery asset(s).`,
    });
  } catch (err) {
    console.error("[ship-access/machinery/assets/batch] POST failed", err);
    return NextResponse.json({ error: "Failed to register machinery batch" }, { status: 500 });
  }
}
