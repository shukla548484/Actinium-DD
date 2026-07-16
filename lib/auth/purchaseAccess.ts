import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/edge";
import { getSessionPayload } from "@/lib/auth/session";
import { buildAuthContext, can, canAccessPage } from "@/lib/db/rbac";
import type { AuthContext } from "@/lib/rbac/types";
import { prisma } from "@/lib/prisma";

export type PurchaseAccessContext = {
  auth: AuthContext;
  userId: string;
  employeeId: string | null;
  /** designationAccessLevel analogue — SYS_ADMIN / platform admin → 100 */
  accessLevel: number;
  canSeeAllVessels: boolean;
  assignedVesselIds: string[];
};

const PURCHASE_PAGE_KEYS = [
  "page.purchase",
  "page.purchase.dashboard",
  "page.purchase.requisitions",
  "page.purchase.orders",
  "page.purchase.invoices",
  "page.purchase.vendors",
  "page.purchase.budget",
  "page.office.procurement",
] as const;

export async function requirePurchaseApiAccess(
  minPermission: string = "page.purchase",
): Promise<{ denied: NextResponse } | { ctx: PurchaseAccessContext }> {
  if (!isAuthEnabled()) {
    return {
      ctx: {
        auth: {
          userId: "dev",
          organizationId: null,
          roleCodes: ["SYS_ADMIN"],
          permissions: new Set(["*"]),
          hierarchyLevel: 1,
        },
        userId: "dev",
        employeeId: null,
        accessLevel: 100,
        canSeeAllVessels: true,
        assignedVesselIds: [],
      },
    };
  }

  const payload = await getSessionPayload();
  if (!payload?.userId) {
    return { denied: NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 }) };
  }

  const auth = await buildAuthContext(payload.userId);
  if (!auth) {
    return { denied: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const hasPurchase =
    can(auth, "platform.tenant.manage") ||
    canAccessPage(auth, minPermission) ||
    PURCHASE_PAGE_KEYS.some((k) => canAccessPage(auth, k));

  if (!hasPurchase) {
    return {
      denied: NextResponse.json({ error: "You do not have purchase module access." }, { status: 403 }),
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: payload.userId, deletedAt: null },
    select: { id: true, role: { select: { code: true, roleNo: true } } },
  });

  const isSysAdmin =
    can(auth, "platform.tenant.manage") ||
    employee?.role?.code === "SYS_ADMIN" ||
    employee?.role?.roleNo === 1001;

  const accessLevel = isSysAdmin ? 100 : (employee?.role?.roleNo ?? 30);

  const assigned = employee
    ? await prisma.employeeVessel.findMany({
        where: { employeeId: employee.id },
        select: { vesselId: true },
      })
    : [];

  return {
    ctx: {
      auth,
      userId: payload.userId,
      employeeId: employee?.id ?? null,
      accessLevel,
      canSeeAllVessels: isSysAdmin || accessLevel >= 50,
      assignedVesselIds: assigned.map((a) => a.vesselId),
    },
  };
}

export function vesselScopeWhere(
  ctx: PurchaseAccessContext,
  vesselId?: string | null,
): { vesselId: string } | { vesselId: { in: string[] } } | Record<string, never> | null {
  if (vesselId) {
    if (!ctx.canSeeAllVessels && !ctx.assignedVesselIds.includes(vesselId)) {
      return null; // denied
    }
    return { vesselId };
  }
  if (ctx.canSeeAllVessels) return {};
  if (ctx.assignedVesselIds.length === 0) return null;
  return { vesselId: { in: ctx.assignedVesselIds } };
}
