import { NextResponse } from "next/server";
import { getOfficeSession } from "@/lib/auth/session";
import { isAuthEnabled } from "@/lib/auth/edge";

/** Office session required for superintendent APIs (full user RBAC enforced in Phase F). */
export async function requireSuperintendentApiAccess(): Promise<NextResponse | null> {
  if (!isAuthEnabled()) return null;
  const ok = await getOfficeSession();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }
  return null;
}
