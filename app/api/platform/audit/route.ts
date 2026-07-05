import { NextResponse } from "next/server";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { listAuditLogs } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireOfficeApiPermission("audit.read");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "30");
  const entityType = searchParams.get("entityType") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const result = await listAuditLogs({ page, limit, entityType, userId });
  return NextResponse.json(result);
}
