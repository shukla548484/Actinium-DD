import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { parseBody, statusBodySchema, vesselUpdateSchema } from "@/lib/admin/validation";
import { deleteVessel, getVessel, setVesselStatus, updateVessel } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const vessel = await getVessel(id);
  if (!vessel) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  return NextResponse.json({ vessel });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(vesselUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getVessel(id);
  if (!existing) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  const vessel = await updateVessel(id, parsed.data);
  return NextResponse.json({ vessel });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(statusBodySchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getVessel(id);
  if (!existing) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  const vessel = await setVesselStatus(id, parsed.data.status);
  return NextResponse.json({ vessel });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getVessel(id);
  if (!existing) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  await deleteVessel(id);
  return NextResponse.json({ ok: true });
}
