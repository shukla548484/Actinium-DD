import { NextResponse } from "next/server";
import { getCrewJobCategories } from "@/lib/shipAccess/crewJobCategories";
import { getCrewPageAccessKeys } from "@/lib/db/crewPageAccess";
import { parseSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export type MobileShipAccessContext = {
  userId: string;
  loginId: string | null;
  employeeId: string | null;
  displayName: string | null;
  designation: string | null;
  vesselLoginId: string | null;
  roleCode: string | null;
  roleName: string | null;
  vessels: { id: string; code: string; name: string }[];
  allowedJobCategories: string[];
  assignedPageKeys: string[];
};

export function getMobileSessionToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  const customHeader = request.headers.get("x-session-token")?.trim();
  return customHeader || null;
}

export async function getMobileShipAccessContext(
  request: Request,
): Promise<MobileShipAccessContext | null> {
  const token = getMobileSessionToken(request);
  const payload = parseSessionToken(token);
  if (!payload?.userId) return null;

  const employee = await prisma.employee.findFirst({
    where: { userId: payload.userId, ...notDeleted },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      vesselLoginId: true,
      role: { select: { code: true, name: true, userType: true } },
      vesselAssignments: {
        where: { signOffDate: null, vessel: { ...notDeleted, status: "active" } },
        select: {
          vessel: { select: { id: true, code: true, name: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!employee?.id || !employee.vesselLoginId) return null;

  const assignedPageKeys = await getCrewPageAccessKeys(employee.id);

  return {
    userId: payload.userId,
    loginId: payload.loginId ?? null,
    employeeId: employee.id,
    displayName: `${employee.firstName} ${employee.lastName}`.trim() || payload.loginId || null,
    designation: employee.designation ?? null,
    vesselLoginId: employee.vesselLoginId ?? null,
    roleCode: employee.role?.code ?? null,
    roleName: employee.role?.name ?? null,
    vessels: employee.vesselAssignments.map((assignment) => assignment.vessel),
    allowedJobCategories: getCrewJobCategories(employee.role?.code ?? null),
    assignedPageKeys,
  };
}

export async function requireMobileShipAccessContext(
  request: Request,
): Promise<
  | { ok: true; context: MobileShipAccessContext }
  | { ok: false; response: NextResponse }
> {
  const context = await getMobileShipAccessContext(request);
  if (!context) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Sign in with the mobile ship access login." },
        { status: 401 },
      ),
    };
  }

  return { ok: true, context };
}
