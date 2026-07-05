import { NextResponse } from "next/server";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { getCrewingDashboardStats } from "@/lib/db/officeDashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireOfficeApiPermission("page.office.department.crewing");
  if (denied) return denied;

  const stats = await getCrewingDashboardStats();
  return NextResponse.json({ stats });
}
