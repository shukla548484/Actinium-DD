import { prisma } from "@/lib/prisma";
import {
  CREW_ASSIGNABLE_PAGES,
  DEFAULT_CREW_PAGE_KEYS,
  expandCrewPagePermissionKeys,
  type CrewPageDefinition,
} from "@/lib/shipAccess/crewPages";
import { notDeleted } from "@/lib/superintendent/helpers";

export type CrewPageAccessDto = {
  employeeId: string;
  employeeName: string;
  designation: string | null;
  vesselLoginId: string | null;
  assignedPageKeys: string[];
  effectivePermissionKeys: string[];
  availablePages: CrewPageDefinition[];
};

export async function getCrewPageAccessKeys(employeeId: string): Promise<string[]> {
  const rows = await prisma.employeeCrewPageAccess.findMany({
    where: { employeeId },
    select: { permissionKey: true },
    orderBy: { permissionKey: "asc" },
  });
  return rows.map((row) => row.permissionKey);
}

export async function getCrewEffectivePermissions(employeeId: string): Promise<Set<string>> {
  const pageKeys = await getCrewPageAccessKeys(employeeId);
  return new Set(expandCrewPagePermissionKeys(pageKeys));
}

export async function crewHasPermission(
  employeeId: string,
  permissionKey: string,
): Promise<boolean> {
  const permissions = await getCrewEffectivePermissions(employeeId);
  return permissions.has(permissionKey);
}

export async function getCrewPageAccessDetail(
  vesselId: string,
  employeeId: string,
): Promise<CrewPageAccessDto | null> {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      deletedAt: null,
      vesselLoginId: { not: null },
      vesselAssignments: { some: { vesselId, signOffDate: null } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      vesselLoginId: true,
    },
  });
  if (!employee) return null;

  const assignedPageKeys = await getCrewPageAccessKeys(employeeId);

  return {
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    designation: employee.designation,
    vesselLoginId: employee.vesselLoginId,
    assignedPageKeys,
    effectivePermissionKeys: expandCrewPagePermissionKeys(assignedPageKeys),
    availablePages: CREW_ASSIGNABLE_PAGES,
  };
}

export async function setCrewPageAccess(employeeId: string, pageKeys: string[]) {
  const allowed = new Set(CREW_ASSIGNABLE_PAGES.map((page) => page.key));
  const normalized = [...new Set(pageKeys.filter((key) => allowed.has(key)))];

  await prisma.$transaction([
    prisma.employeeCrewPageAccess.deleteMany({ where: { employeeId } }),
    ...(normalized.length > 0
      ? [
          prisma.employeeCrewPageAccess.createMany({
            data: normalized.map((permissionKey) => ({ employeeId, permissionKey })),
          }),
        ]
      : []),
  ]);

  // Keep unified module/page tables in sync when pages are edited from crew credentials.
  await prisma.$transaction(async (tx) => {
    await tx.employeeModulePage.deleteMany({
      where: { employeeId, moduleCode: "shipAccess" },
    });
    await tx.employeeModuleAssignment.deleteMany({
      where: { employeeId, moduleCode: "shipAccess" },
    });
    if (normalized.length > 0) {
      await tx.employeeModuleAssignment.create({
        data: { employeeId, moduleCode: "shipAccess" },
      });
      await tx.employeeModulePage.createMany({
        data: normalized.map((pageKey) => ({
          employeeId,
          moduleCode: "shipAccess",
          pageKey,
        })),
      });
    }
  });

  return getCrewPageAccessKeys(employeeId);
}

export async function assignDefaultCrewPageAccess(employeeId: string) {
  return setCrewPageAccess(employeeId, DEFAULT_CREW_PAGE_KEYS);
}

export async function listCrewEmployeesForVessel(vesselId: string) {
  return prisma.employee.findMany({
    where: {
      ...notDeleted,
      vesselLoginId: { not: null },
      vesselAssignments: { some: { vesselId, signOffDate: null } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      vesselLoginId: true,
      crewPageAccess: { select: { permissionKey: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
