import { NextResponse } from "next/server";
import { getSessionPayload, touchSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Refresh session idle deadline on user activity. */
export async function POST() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  touchSessionCookie(res, payload);
  return res;
}
