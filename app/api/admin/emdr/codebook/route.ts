import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getEmdrCodebook } from "@/lib/emdr/registry";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const codebook = getEmdrCodebook();
  return NextResponse.json(codebook);
}
