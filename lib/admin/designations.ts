import { SYSTEM_ROLES } from "@/lib/rbac/roles";
import type { RbacUserType } from "@prisma/client";
import type { RoleCategoryTier } from "@/lib/rbac/types";

export type DesignationOption = {
  value: string;
  label: string;
  department: string;
  roleCode: string;
  roleNo: number;
  hierarchyLevel: number;
  categoryTier: RoleCategoryTier;
  approvalLevel: number;
  reportsToCode: string | null;
  jobScope: string;
  searchText: string;
};

/** Designations from the RBAC role catalog (spreadsheet seed). */
export const DESIGNATION_OPTIONS: DesignationOption[] = SYSTEM_ROLES.map((role) => ({
  value: role.code,
  label: role.designation,
  department: role.department,
  roleCode: role.code,
  roleNo: role.roleNo,
  hierarchyLevel: role.hierarchyLevel,
  categoryTier: role.categoryTier,
  approvalLevel: role.approvalLevel,
  reportsToCode: role.reportsToCode,
  jobScope: role.jobScope,
  searchText: `${role.roleNo} ${role.designation} ${role.department} ${role.code} ${role.name} level ${role.hierarchyLevel} approval ${role.approvalLevel}`,
}));

export function getDesignationByCode(code: string): DesignationOption | undefined {
  return DESIGNATION_OPTIONS.find((d) => d.value === code);
}

export function getDesignationByLabel(label: string): DesignationOption | undefined {
  return DESIGNATION_OPTIONS.find((d) => d.label === label);
}

const roleUserTypeByCode = Object.fromEntries(SYSTEM_ROLES.map((role) => [role.code, role.userType]));

export function filterDesignationsByUserType(userType?: RbacUserType): DesignationOption[] {
  if (!userType) return DESIGNATION_OPTIONS;
  return DESIGNATION_OPTIONS.filter((option) => roleUserTypeByCode[option.roleCode] === userType);
}

export function formatDesignationLabel(option: DesignationOption): string {
  return `${option.roleNo} · L${option.hierarchyLevel} · A${option.approvalLevel} · ${option.label}`;
}
