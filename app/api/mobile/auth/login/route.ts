import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { verifyEmployeeLogin } from "@/lib/db/employeeAuth";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    loginId?: string;
    employeeId?: string;
    password?: string;
  };

  const loginId = (body.loginId ?? body.employeeId ?? "").trim();
  const password = body.password ?? "";

  if (!loginId) {
    return NextResponse.json({ error: "Login ID is required." }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const user = await verifyEmployeeLogin(loginId, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid login ID or password." }, { status: 401 });
  }

  if (!user.isVesselCrew || !user.employeeId) {
    return NextResponse.json(
      { error: "This mobile app currently supports vessel crew accounts only." },
      { status: 403 },
    );
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { lastLoginAt: new Date() },
  });

  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, ...notDeleted },
    select: {
      designation: true,
      vesselAssignments: {
        where: { signOffDate: null, vessel: { ...notDeleted, status: "active" } },
        select: { vessel: { select: { id: true, code: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  const vessels = employee?.vesselAssignments.map((assignment) => assignment.vessel) ?? [];
  const defaultVesselId = vessels[0]?.id ?? null;
  const token = createSessionToken({
    userId: user.userId,
    loginId: user.loginId,
    isVesselCrew: user.isVesselCrew,
    rbacUserType: user.rbacUserType,
  });

  return NextResponse.json({
    ok: true,
    token,
    user: {
      loginId: user.loginId,
      displayName: user.displayName,
      employeeCode: user.employeeCode,
      roleCode: user.roleCode,
      designation: employee?.designation ?? null,
      vesselLoginId: user.vesselLoginId,
    },
    vessels,
    defaultVesselId,
  });
}
