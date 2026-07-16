import prisma from "@/lib/prisma";
import { getMasterCompanyIds } from "@/lib/company-hierarchy";

/** Shore roles that receive procurement task notifications when vessel-assigned. */
export const SHORE_PROCUREMENT_ACCESS_LEVELS = [
  32, 33, 37, 39, 41, 44, 46, 47, 48, 50,
] as const;

export type ShoreApproverAuditRow = {
  employeeId: string;
  employeeLabel: string;
  email: string | null;
  accessLevel: number;
  companyName: string | null;
  hasPurchaseModule: boolean;
  assignedVesselCount: number;
  eligibleVesselCount: number;
  missingVesselIds: string[];
  missingVesselNames: string[];
};

export type ShoreApproverVesselAuditResult = {
  rows: ShoreApproverAuditRow[];
  employeesWithGaps: number;
  totalMissingAssignments: number;
  employeesWithoutCompany: string[];
  employeesWithoutPurchaseModule: string[];
};

async function purchaseModuleIds(): Promise<Set<string>> {
  const modules = await prisma.module.findMany({
    where: { isActive: true, name: { equals: "Purchase", mode: "insensitive" } },
    select: { id: true },
  });
  return new Set(modules.map((m) => m.id));
}

export async function auditShoreApproverVesselAssignments(): Promise<ShoreApproverVesselAuditResult> {
  const purchaseIds = await purchaseModuleIds();

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      designationAccessLevel: { in: [...SHORE_PROCUREMENT_ACCESS_LEVELS] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      designationAccessLevel: true,
      companyId: true,
      company: { select: { name: true } },
      assignedModules: { select: { moduleId: true } },
      assignedVessels: { select: { vesselId: true } },
    },
    orderBy: [{ designationAccessLevel: "asc" }, { lastName: "asc" }],
  });

  const rows: ShoreApproverAuditRow[] = [];
  const employeesWithoutCompany: string[] = [];
  const employeesWithoutPurchaseModule: string[] = [];
  let totalMissingAssignments = 0;

  for (const emp of employees) {
    const accessLevel = emp.designationAccessLevel ?? 0;
    const label = `${emp.firstName} ${emp.lastName}`.trim();
    const hasPurchaseModule = emp.assignedModules.some((m) =>
      purchaseIds.has(m.moduleId)
    );

    if (!hasPurchaseModule && accessLevel !== 50) {
      employeesWithoutPurchaseModule.push(`${label} (L${accessLevel})`);
    }

    if (!emp.companyId) {
      employeesWithoutCompany.push(`${label} (L${accessLevel})`);
      rows.push({
        employeeId: emp.id,
        employeeLabel: label,
        email: emp.email,
        accessLevel,
        companyName: null,
        hasPurchaseModule,
        assignedVesselCount: emp.assignedVessels.length,
        eligibleVesselCount: 0,
        missingVesselIds: [],
        missingVesselNames: [],
      });
      continue;
    }

    const companyIds = await getMasterCompanyIds(prisma, emp.companyId);
    const eligibleVessels = await prisma.vessel.findMany({
      where: { isActive: true, companyId: { in: companyIds } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    const assignedSet = new Set(emp.assignedVessels.map((a) => a.vesselId));
    const missing = eligibleVessels.filter((v) => !assignedSet.has(v.id));

    totalMissingAssignments += missing.length;

    rows.push({
      employeeId: emp.id,
      employeeLabel: label,
      email: emp.email,
      accessLevel,
      companyName: emp.company?.name ?? null,
      hasPurchaseModule,
      assignedVesselCount: assignedSet.size,
      eligibleVesselCount: eligibleVessels.length,
      missingVesselIds: missing.map((v) => v.id),
      missingVesselNames: missing.map(
        (v) => `${v.name}${v.code ? ` (${v.code})` : ""}`
      ),
    });
  }

  const employeesWithGaps = rows.filter((r) => r.missingVesselIds.length > 0).length;

  return {
    rows,
    employeesWithGaps,
    totalMissingAssignments,
    employeesWithoutCompany,
    employeesWithoutPurchaseModule,
  };
}

export type ApplyShoreApproverVesselResult = {
  dryRun: boolean;
  assignmentsCreated: number;
  employeesUpdated: number;
  details: Array<{ employeeLabel: string; vesselsAdded: string[] }>;
};

/** Assign each shore approver to all active vessels in their company hierarchy. */
export async function applyShoreApproverVesselAssignments(
  dryRun: boolean
): Promise<ApplyShoreApproverVesselResult> {
  const audit = await auditShoreApproverVesselAssignments();
  let assignmentsCreated = 0;
  let employeesUpdated = 0;
  const details: ApplyShoreApproverVesselResult["details"] = [];

  for (const row of audit.rows) {
    if (row.missingVesselIds.length === 0) continue;

    employeesUpdated += 1;
    details.push({
      employeeLabel: row.employeeLabel,
      vesselsAdded: row.missingVesselNames,
    });

    if (dryRun) {
      assignmentsCreated += row.missingVesselIds.length;
      continue;
    }

    await prisma.employeeVessel.createMany({
      data: row.missingVesselIds.map((vesselId) => ({
        employeeId: row.employeeId,
        vesselId,
      })),
      skipDuplicates: true,
    });
    assignmentsCreated += row.missingVesselIds.length;
  }

  return { dryRun, assignmentsCreated, employeesUpdated, details };
}
