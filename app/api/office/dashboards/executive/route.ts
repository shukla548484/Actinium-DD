import { NextResponse } from "next/server";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { getExecutiveBudgetSummary } from "@/lib/db/officeDashboards";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireOfficeApiPermission("page.office.department.executive");
  if (denied) return denied;

  const summary = await getExecutiveBudgetSummary();
  return NextResponse.json(summary);
}
