import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  getCrewPageAccessDetail,
  setCrewPageAccess,
} from "@/lib/db/crewPageAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; employeeId: string }> };

const patchSchema = z.object({
  pageKeys: z.array(z.string()).default([]),
});

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id, employeeId } = await context.params;
  const detail = await getCrewPageAccessDetail(id, employeeId);
  if (!detail) {
    return NextResponse.json({ error: "Crew credential not found on this vessel" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id, employeeId } = await context.params;
  const existing = await getCrewPageAccessDetail(id, employeeId);
  if (!existing) {
    return NextResponse.json({ error: "Crew credential not found on this vessel" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const assignedPageKeys = await setCrewPageAccess(employeeId, parsed.data.pageKeys);
  const detail = await getCrewPageAccessDetail(id, employeeId);

  return NextResponse.json({ assignedPageKeys, detail });
}
