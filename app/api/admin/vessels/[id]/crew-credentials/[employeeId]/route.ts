import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { crewCredentialUpdateSchema, parseBody } from "@/lib/admin/validation";
import {
  deleteVesselCrewCredential,
  getCrewCredentialDetail,
  updateVesselCrewCredential,
} from "@/lib/db/crewCredentials";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; employeeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id, employeeId } = await context.params;
  const credential = await getCrewCredentialDetail(id, employeeId);
  if (!credential) {
    return NextResponse.json({ error: "Crew credential not found" }, { status: 404 });
  }

  return NextResponse.json({ credential });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id, employeeId } = await context.params;
  const parsed = parseBody(crewCredentialUpdateSchema, await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const credential = await updateVesselCrewCredential(id, employeeId, parsed.data);
    return NextResponse.json({ credential });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update crew credential";
    if (msg.includes("already registered") || msg.includes("Unique constraint")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("not found") || msg.includes("Invalid")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id, employeeId } = await context.params;

  try {
    await deleteVesselCrewCredential(id, employeeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete crew credential";
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
