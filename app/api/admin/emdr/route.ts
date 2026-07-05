import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getEmdrRegistryReport } from "@/lib/emdr/registry";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const report = getEmdrRegistryReport();
  return NextResponse.json(report);
}
