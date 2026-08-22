import { NextResponse } from "next/server";
import type { EntityStatus } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { parseBody, statusBodySchema, vesselCreateSchema, vesselUpdateSchema } from "@/lib/admin/validation";
import { createVessel, listVessels } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as EntityStatus | "all" | null;
  const result = await listVessels({
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 20),
    search: searchParams.get("search") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
    status: status && status !== "all" ? status : undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  const parsed = parseBody(vesselCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const vessel = await createVessel(parsed.data);
    return NextResponse.json({ vessel }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create vessel";
    const status = /already used/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
