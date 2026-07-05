import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/edge";
import { getAuthSnapshotForSession } from "@/lib/auth/authSnapshot";

export const dynamic = "force-dynamic";

/** Cached RBAC payload for desktop / offline clients. Refresh on sync. */
export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ authEnabled: false, snapshot: null });
  }

  const snapshot = await getAuthSnapshotForSession();
  if (!snapshot) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  return NextResponse.json({ authEnabled: true, snapshot });
}
