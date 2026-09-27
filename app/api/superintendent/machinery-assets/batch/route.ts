import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { createMachineryAssetsBatch } from "@/lib/db/vesselMachineryAssets";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

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

async function resolveVesselId(body: {
  dryDockProjectId?: string;
  vesselId?: string;
}) {
  if (body.dryDockProjectId) {
    const access = await assertDryDockProjectInScope(body.dryDockProjectId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId: access.vesselId };
  }
  if (body.vesselId) {
    const access = await assertVesselInScope(body.vesselId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId: body.vesselId };
  }
  return {
    error: NextResponse.json(
      { error: "dryDockProjectId or vesselId required" },
      { status: 400 },
    ),
  };
}

export async function POST(request: Request) {
  try {
    const denied = await requireSuperintendentApiAccess();
    if (denied) return denied;

    const body = (await request.json()) as {
      dryDockProjectId?: string;
      vesselId?: string;
      rows?: BatchItem[];
    };

    const resolved = await resolveVesselId(body);
    if ("error" in resolved) return resolved.error;

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

    const result = await createMachineryAssetsBatch(resolved.vesselId, inputs);
    return NextResponse.json({
      created: result.created,
      failed: result.failed,
      message: `Registered ${result.created.length} of ${inputs.length} machinery asset(s).`,
    });
  } catch (err) {
    console.error("[superintendent/machinery-assets/batch] POST failed", err);
    return NextResponse.json({ error: "Failed to register machinery batch" }, { status: 500 });
  }
}
