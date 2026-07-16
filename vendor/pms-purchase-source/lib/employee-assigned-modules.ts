import "server-only";

import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { getDatabaseForUser } from "@/lib/services/master-company-database";

export type AssignedModuleRow = {
  module: {
    id: string;
    name: string;
    description: string | null;
  };
};

const moduleSelect = {
  module: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
} as const;

/**
 * Load employee module assignments from the same database login uses
 * (master for admins; company DB for 26–49 and active company tenants).
 */
export async function loadEmployeeAssignedModules(employee: {
  id: string;
  designationAccessLevel: number | null | undefined;
  companyId?: string | null;
  masterCompanyId?: string | null;
  company?: { id: string } | null;
}): Promise<AssignedModuleRow[]> {
  const accessLevel = employee.designationAccessLevel;

  if (isAdminEquivalentAccessLevel(accessLevel)) {
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });
    return allModules.map((module) => ({ module }));
  }

  const companyId = employee.company?.id ?? employee.companyId;
  if (companyId) {
    try {
      const { prisma: db } = await getDatabaseForUser(
        employee.id,
        accessLevel ?? null,
        companyId,
        employee.masterCompanyId
      );
      const rows = await db.employeeModule.findMany({
        where: { employeeId: employee.id },
        select: moduleSelect,
        orderBy: { module: { name: "asc" } },
      });
      if (rows.length > 0) {
        return rows as AssignedModuleRow[];
      }
    } catch (error) {
      console.warn(
        "[loadEmployeeAssignedModules] Company DB lookup failed, falling back to master:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const rows = await prisma.employeeModule.findMany({
    where: { employeeId: employee.id },
    select: moduleSelect,
    orderBy: { module: { name: "asc" } },
  });
  return rows as AssignedModuleRow[];
}
