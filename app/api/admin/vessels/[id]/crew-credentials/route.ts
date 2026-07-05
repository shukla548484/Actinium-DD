import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { crewCredentialCreateSchema, parseBody } from "@/lib/admin/validation";
import {
  createVesselCrewCredential,
  getCrewCredentialsContext,
} from "@/lib/db/crewCredentials";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const data = await getCrewCredentialsContext(id);
  if (!data) {
    return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = parseBody(crewCredentialCreateSchema, await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const employee = await createVesselCrewCredential(id, parsed.data);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create crew credential";
    if (msg.includes("already registered") || msg.includes("Unique constraint")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("not found") || msg.includes("Invalid")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
