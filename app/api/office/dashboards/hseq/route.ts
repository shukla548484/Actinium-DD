import { NextResponse } from "next/server";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { getHseqDashboardStats } from "@/lib/db/officeDashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireOfficeApiPermission("page.office.department.hseq");
  if (denied) return denied;

  const stats = await getHseqDashboardStats();
  return NextResponse.json({ stats });
}
