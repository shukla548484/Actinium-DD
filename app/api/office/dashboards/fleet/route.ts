import { NextResponse } from "next/server";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { getFleetDashboardStats } from "@/lib/db/officeDashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireOfficeApiPermission("page.office.department.fleet");
  if (denied) return denied;

  const stats = await getFleetDashboardStats();
  return NextResponse.json({ stats });
}
