import { NextResponse } from "next/server";
import { getOfficeSession } from "@/lib/auth/session";

/** Office / vessel user session required for ship access APIs. */
export async function requireShipAccessApiAccess(): Promise<NextResponse | null> {
  const ok = await getOfficeSession();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }
  return null;
}
