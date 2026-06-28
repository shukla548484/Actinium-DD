import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/employeeAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (payload.officeBootstrap) {
    return NextResponse.json({
      authenticated: true,
      user: {
        displayName: "Office User",
        loginId: null,
        employeeCode: null,
        officeBootstrap: true,
      },
    });
  }

  if (!payload.userId) {
    return NextResponse.json({ authenticated: true, user: null });
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: user.userId,
      displayName: user.displayName,
      loginId: user.loginId,
      employeeCode: user.employeeCode,
      email: user.email,
      designation: user.designation,
      officeBootstrap: false,
    },
  });
}
