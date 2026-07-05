import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { verifyEmployeeLogin } from "@/lib/db/employeeAuth";
import { loginDestinationForUserType } from "@/lib/auth/portalAccess";
import { SHIP_ACCESS_VESSEL_COOKIE } from "@/lib/shipAccess/scope";
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

  await prisma.user.update({
    where: { id: user.userId },
    data: { lastLoginAt: new Date() },
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      loginId: user.loginId,
      displayName: user.displayName,
      employeeCode: user.employeeCode,
      isVesselCrew: user.isVesselCrew,
      rbacUserType: user.rbacUserType,
      roleCode: user.roleCode,
      vesselLoginId: user.vesselLoginId,
      portalHome: loginDestinationForUserType(user.rbacUserType),
    },
  });
  res.cookies.set(
    COOKIE_NAME,
    createSessionToken({
      userId: user.userId,
      loginId: user.loginId,
      isVesselCrew: user.isVesselCrew,
      rbacUserType: user.rbacUserType,
    }),
    sessionCookieOptions(),
  );

  if (user.isVesselCrew && user.employeeId) {
    const assignment = await prisma.employeeVessel.findFirst({
      where: {
        employeeId: user.employeeId,
        signOffDate: null,
        vessel: { ...notDeleted, status: "active" },
      },
      orderBy: { assignedAt: "asc" },
      select: { vesselId: true },
    });
    if (assignment) {
      res.cookies.set(SHIP_ACCESS_VESSEL_COOKIE, assignment.vesselId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return res;
}
