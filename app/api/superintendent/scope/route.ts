import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getScopedVesselIds,
  SUPERINTENDENT_EMPLOYEE_COOKIE,
} from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const employeeId = jar.get(SUPERINTENDENT_EMPLOYEE_COOKIE)?.value?.trim() ?? null;
  const vesselIds = await getScopedVesselIds();

  let employee: { id: string; name: string; designation: string | null } | null = null;
  if (employeeId) {
    const row = await prisma.employee.findFirst({
      where: { id: employeeId, ...notDeleted },
      select: { id: true, firstName: true, lastName: true, designation: true },
    });
    if (row) {
      employee = {
        id: row.id,
        name: `${row.firstName} ${row.lastName}`,
        designation: row.designation,
      };
    }
  }

  const employees = await prisma.employee.findMany({
    where: { ...notDeleted, status: "active" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      _count: { select: { vesselAssignments: true } },
    },
    take: 200,
  });

  return NextResponse.json({
    employeeId,
    employee,
    vesselIds: vesselIds ?? null,
    scoped: employeeId != null,
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      designation: e.designation,
      vesselCount: e._count.vesselAssignments,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { employeeId?: string | null };
  const res = NextResponse.json({ ok: true, employeeId: body.employeeId ?? null });

  if (body.employeeId) {
    const exists = await prisma.employee.findFirst({
      where: { id: body.employeeId, ...notDeleted, status: "active" },
    });
    if (!exists) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    res.cookies.set(SUPERINTENDENT_EMPLOYEE_COOKIE, body.employeeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  } else {
    res.cookies.set(SUPERINTENDENT_EMPLOYEE_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}
