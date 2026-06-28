import { NextResponse } from "next/server";
import type { AppSurface } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { listPagePermissions, listPermissionsGrouped } from "@/lib/db/adminRbac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module") ?? undefined;
  const pagesOnly = searchParams.get("pagesOnly") === "1";
  const appSurface = searchParams.get("appSurface") as AppSurface | null;

  if (pagesOnly) {
    const pages = await listPagePermissions(appSurface ?? undefined);
    return NextResponse.json({ pages });
  }

  const grouped = await listPermissionsGrouped(module);
  return NextResponse.json({ grouped });
}
