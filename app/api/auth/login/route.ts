import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  isAuthEnabled,
  sessionCookieOptions,
  verifyOfficePassword,
} from "@/lib/auth/session";
import { verifyEmployeeLogin } from "@/lib/db/employeeAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    const res = NextResponse.json({ ok: true, authDisabled: true });
    res.cookies.set(COOKIE_NAME, createSessionToken(), sessionCookieOptions());
    return res;
  }

  const body = (await request.json()) as {
    loginId?: string;
    employeeId?: string;
    password?: string;
  };

  const loginId = (body.loginId ?? body.employeeId ?? "").trim();
  const password = body.password ?? "";

  if (loginId) {
    const user = await verifyEmployeeLogin(loginId, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid employee ID or password." }, { status: 401 });
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
      },
    });
    res.cookies.set(
      COOKIE_NAME,
      createSessionToken({ userId: user.userId, loginId: user.loginId }),
      sessionCookieOptions(),
    );
    return res;
  }

  if (!password || !verifyOfficePassword(password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, officeBootstrap: true });
  res.cookies.set(COOKIE_NAME, createSessionToken({ officeBootstrap: true }), sessionCookieOptions());
  return res;
}
