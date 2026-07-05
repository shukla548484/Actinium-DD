import { NextResponse } from "next/server";
import type { EntityStatus } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { employeeCreateSchema, parseBody, employeeUpdateSchema } from "@/lib/admin/validation";
import { createEmployee, listEmployees } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as EntityStatus | "all" | null;
  const userType = searchParams.get("userType") as import("@prisma/client").RbacUserType | null;
  const result = await listEmployees({
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 20),
    search: searchParams.get("search") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
    status: status && status !== "all" ? status : undefined,
    userType: userType ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const parsed = parseBody(employeeCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const employee = await createEmployee(parsed.data);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create employee";
    if (msg.includes("Unique constraint") || msg.includes("already registered")) {
      return NextResponse.json({ error: msg.includes("already") ? msg : "Email or employee code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
