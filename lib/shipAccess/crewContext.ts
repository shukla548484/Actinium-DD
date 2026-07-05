import { cookies } from "next/headers";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";
import { isVesselCrewRoleCode } from "@/lib/admin/crewLoginId";
import { getCrewJobCategories } from "@/lib/shipAccess/crewJobCategories";
import { SHIP_ACCESS_VESSEL_COOKIE } from "@/lib/shipAccess/scope";
import { getCrewPageAccessKeys } from "@/lib/db/crewPageAccess";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export type CrewVesselSummary = {
  id: string;
  code: string;
  name: string;
};

export type CrewSessionContext = {
  isVesselCrew: boolean;
  roleCode: string | null;
  roleName: string | null;
  designation: string | null;
  vesselLoginId: string | null;
  employeeId: string | null;
  vessels: CrewVesselSummary[];
  primaryVesselId: string | null;
  allowedJobCategories: string[];
  assignedPageKeys: string[];
  officeBootstrap: boolean;
};

export async function getCrewSessionContext(): Promise<CrewSessionContext | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;

  if (payload.officeBootstrap) {
    return {
      isVesselCrew: false,
      roleCode: null,
      roleName: null,
      designation: null,
      vesselLoginId: null,
      employeeId: null,
      vessels: [],
      primaryVesselId: null,
      allowedJobCategories: [],
      officeBootstrap: true,
      assignedPageKeys: [],
    };
  }

  const userId = payload.userId ?? (await getSessionUserId());
  if (!userId) {
    return {
      isVesselCrew: false,
      roleCode: null,
      roleName: null,
      designation: null,
      vesselLoginId: null,
      employeeId: null,
      vessels: [],
      primaryVesselId: null,
      allowedJobCategories: [],
      officeBootstrap: false,
      assignedPageKeys: [],
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { userId, ...notDeleted },
    select: {
      id: true,
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

  const roleCode = employee?.role?.code ?? null;
  const isVesselCrew =
    Boolean(employee?.vesselLoginId) ||
    employee?.role?.userType === "vessel" ||
    isVesselCrewRoleCode(roleCode);

  const vessels =
    employee?.vesselAssignments.map((assignment) => assignment.vessel) ?? [];

  const jar = await cookies();
  const cookieVesselId = jar.get(SHIP_ACCESS_VESSEL_COOKIE)?.value?.trim();
  const primaryVesselId =
    cookieVesselId && vessels.some((vessel) => vessel.id === cookieVesselId)
      ? cookieVesselId
      : (vessels[0]?.id ?? null);

  const assignedPageKeys =
    isVesselCrew && employee?.id ? await getCrewPageAccessKeys(employee.id) : [];

  return {
    isVesselCrew,
    roleCode,
    roleName: employee?.role?.name ?? null,
    designation: employee?.designation ?? null,
    vesselLoginId: employee?.vesselLoginId ?? null,
    employeeId: employee?.id ?? null,
    vessels,
    primaryVesselId,
    allowedJobCategories: getCrewJobCategories(roleCode),
    assignedPageKeys,
    officeBootstrap: false,
  };
}

export { CREW_ALLOWED_PATH_PREFIXES, isCrewAllowedPath } from "@/lib/shipAccess/crewPaths";
