import { NextResponse } from "next/server";
import { requireExternalApiAccess, getExternalSessionContext } from "@/lib/auth/externalAccess";
import {
  getExternalOversightProjects,
  getExternalServiceReports,
  getExternalVendorQuotes,
} from "@/lib/db/externalPortal";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireExternalApiAccess();
  if (denied) return denied;

  const session = await getExternalSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const roleCode = session.ctx.roleCodes[0] ?? null;
  const email = session.user.email ?? "";

  const [quotes, oversightProjects, serviceReports] = await Promise.all([
    email ? getExternalVendorQuotes(email) : Promise.resolve([]),
    getExternalOversightProjects(roleCode),
    getExternalServiceReports(roleCode),
  ]);

  return NextResponse.json({
    roleCode,
    quotes,
    oversightProjects,
    serviceReports,
  });
}
