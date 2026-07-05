import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getMtilProgressReport } from "@/lib/mtil/progress";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  return NextResponse.json({ progress: getMtilProgressReport() });
}
