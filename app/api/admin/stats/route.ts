import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getAdminStats } from "@/lib/db/adminRbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const stats = await getAdminStats();
  return NextResponse.json({ stats });
}
