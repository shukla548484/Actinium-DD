import { prisma } from "@/lib/prisma";
import {
  ACCESS_MODULES,
  getAccessModule,
  isValidModuleCode,
  isValidPageKeyForModule,
  listAccessModulesForUserType,
  type AccessModuleCode,
  type AccessModuleDefinition,
} from "@/lib/rbac/accessModules";
import { expandCrewPagePermissionKeys } from "@/lib/shipAccess/crewPages";
import { setCrewPageAccess, getCrewPageAccessKeys } from "@/lib/db/crewPageAccess";
import type { RbacUserType } from "@prisma/client";

export type ModulePageAssignmentInput = {
  moduleCode: string;
  pageKeys: string[];
};

export type EmployeeModuleAccessDto = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation: string | null;
    vesselLoginId: string | null;
    userType: RbacUserType;
    roleCode: string | null;
    roleName: string | null;
  };
  availableModules: AccessModuleDefinition[];
  assignedModuleCodes: string[];
  /** pageKey → moduleCode */
  assignedPages: { moduleCode: string; pageKey: string }[];
};

async function resolveEmployeeUserType(employeeId: string): Promise<{
  employee: NonNullable<Awaited<ReturnType<typeof loadEmployeeBase>>>;
  userType: RbacUserType;
} | null> {
  const employee = await loadEmployeeBase(employeeId);
  if (!employee) return null;

  const userType: RbacUserType =
    employee.role?.userType ??
    (employee.vesselLoginId ? "vessel" : "office");

  return { employee, userType };
}

async function loadEmployeeBase(employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      designation: true,
      vesselLoginId: true,
      role: { select: { code: true, name: true, userType: true } },
    },
  });
}

export async function getEmployeeAssignedModuleCodes(
  employeeId: string,
): Promise<string[]> {
  const rows = await prisma.employeeModuleAssignment.findMany({
    where: { employeeId },
    select: { moduleCode: true },
    orderBy: { moduleCode: "asc" },
  });
  return rows.map((r) => r.moduleCode);
}

export async function getEmployeeAssignedPageKeys(
  employeeId: string,
): Promise<string[]> {
  const rows = await prisma.employeeModulePage.findMany({
    where: { employeeId },
    select: { pageKey: true },
    orderBy: { pageKey: "asc" },
  });
  return rows.map((r) => r.pageKey);
}

export async function getEmployeeModuleAccessDetail(
  employeeId: string,
): Promise<EmployeeModuleAccessDto | null> {
  const resolved = await resolveEmployeeUserType(employeeId);
  if (!resolved) return null;

  const { employee, userType } = resolved;
  const [moduleRows, pageRows] = await Promise.all([
    prisma.employeeModuleAssignment.findMany({
      where: { employeeId },
      select: { moduleCode: true },
      orderBy: { moduleCode: "asc" },
    }),
    prisma.employeeModulePage.findMany({
      where: { employeeId },
      select: { moduleCode: true, pageKey: true },
      orderBy: [{ moduleCode: "asc" }, { pageKey: "asc" }],
    }),
  ]);

  let assignedModuleCodes = moduleRows.map((r) => r.moduleCode);
  let assignedPages = pageRows.map((r) => ({
    moduleCode: r.moduleCode,
    pageKey: r.pageKey,
  }));

  // Seed UI from legacy crew page access when no module rows exist yet.
  if (
    userType === "vessel" &&
    assignedModuleCodes.length === 0 &&
    employee.vesselLoginId
  ) {
    const crewKeys = await getCrewPageAccessKeys(employeeId);
    if (crewKeys.length > 0) {
      assignedModuleCodes = ["shipAccess"];
      assignedPages = crewKeys.map((pageKey) => ({
        moduleCode: "shipAccess",
        pageKey,
      }));
    }
  }

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      vesselLoginId: employee.vesselLoginId,
      userType,
      roleCode: employee.role?.code ?? null,
      roleName: employee.role?.name ?? null,
    },
    availableModules: listAccessModulesForUserType(userType),
    assignedModuleCodes,
    assignedPages,
  };
}

export async function setEmployeeModuleAccess(
  employeeId: string,
  assignments: ModulePageAssignmentInput[],
): Promise<EmployeeModuleAccessDto | null> {
  const resolved = await resolveEmployeeUserType(employeeId);
  if (!resolved) return null;

  const { employee, userType } = resolved;
  const allowedModules = new Set(
    listAccessModulesForUserType(userType).map((m) => m.code),
  );

  const normalized: { moduleCode: AccessModuleCode; pageKeys: string[] }[] = [];

  for (const row of assignments) {
    if (!isValidModuleCode(row.moduleCode)) continue;
    if (!allowedModules.has(row.moduleCode)) continue;
    const pageKeys = [
      ...new Set(
        row.pageKeys.filter((key) => isValidPageKeyForModule(row.moduleCode, key)),
      ),
    ];
    // Module with zero pages is still a module assignment only if pages provided —
    // require at least one page so "module then pages" is enforced.
    if (pageKeys.length === 0) continue;
    normalized.push({ moduleCode: row.moduleCode, pageKeys });
  }

  await prisma.$transaction(async (tx) => {
    await tx.employeeModuleAssignment.deleteMany({ where: { employeeId } });
    await tx.employeeModulePage.deleteMany({ where: { employeeId } });

    if (normalized.length > 0) {
      await tx.employeeModuleAssignment.createMany({
        data: normalized.map((n) => ({
          employeeId,
          moduleCode: n.moduleCode,
        })),
      });
      await tx.employeeModulePage.createMany({
        data: normalized.flatMap((n) =>
          n.pageKeys.map((pageKey) => ({
            employeeId,
            moduleCode: n.moduleCode,
            pageKey,
          })),
        ),
      });
    }
  });

  // Keep legacy crew page table in sync for vessel enforcement path.
  const shipAccess = normalized.find((n) => n.moduleCode === "shipAccess");
  if (employee.vesselLoginId) {
    await setCrewPageAccess(employeeId, shipAccess?.pageKeys ?? []);
  }

  return getEmployeeModuleAccessDetail(employeeId);
}

/**
 * Effective page permission keys for an employee.
 * Empty = no module/page access (SYS_ADMIN bypasses elsewhere).
 */
export async function getEffectiveEmployeePageKeys(
  employeeId: string,
): Promise<string[]> {
  const pageKeys = await getEmployeeAssignedPageKeys(employeeId);
  if (pageKeys.length > 0) return pageKeys;

  // Legacy crew-only rows before module migration
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { vesselLoginId: true },
  });
  if (employee?.vesselLoginId) {
    return getCrewPageAccessKeys(employeeId);
  }
  return [];
}

export async function getEffectiveEmployeePermissionKeys(
  employeeId: string,
): Promise<Set<string>> {
  const pageKeys = await getEffectiveEmployeePageKeys(employeeId);
  const expanded = expandCrewPagePermissionKeys(pageKeys);
  return new Set([...pageKeys, ...expanded]);
}

export function modulesCatalog(): AccessModuleDefinition[] {
  return ACCESS_MODULES;
}

export function describeModule(code: string) {
  return getAccessModule(code);
}
