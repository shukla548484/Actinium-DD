import { SYSTEM_ROLES } from "@/lib/rbac/roles";

export type DesignationOption = {
  value: string;
  label: string;
  department: string;
  roleCode: string;
  searchText: string;
};

/** Designations from the RBAC role catalog (spreadsheet seed). */
export const DESIGNATION_OPTIONS: DesignationOption[] = SYSTEM_ROLES.map((role) => ({
  value: role.code,
  label: role.designation,
  department: role.department,
  roleCode: role.code,
  searchText: `${role.designation} ${role.department} ${role.code} ${role.name}`,
}));

export function getDesignationByCode(code: string): DesignationOption | undefined {
  return DESIGNATION_OPTIONS.find((d) => d.value === code);
}

export function getDesignationByLabel(label: string): DesignationOption | undefined {
  return DESIGNATION_OPTIONS.find((d) => d.label === label);
}
