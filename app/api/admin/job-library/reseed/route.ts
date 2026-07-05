import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { resetJobLibrarySeedForDev } from "@/lib/vessel/jobLibrary/seed";

export const runtime = "nodejs";

/** Re-seed job library from catalog (dev/admin only — clears existing nodes). */
export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_JOB_LIBRARY_RESEED !== "true") {
    return NextResponse.json({ error: "Reseed disabled in production." }, { status: 403 });
  }

  await resetJobLibrarySeedForDev();
  return NextResponse.json({ ok: true });
}
