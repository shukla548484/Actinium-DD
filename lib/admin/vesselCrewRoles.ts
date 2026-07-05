import { SYSTEM_ROLES } from "@/lib/rbac/roles";

export type VesselCrewRoleOption = {
  roleCode: string;
  designation: string;
  department: string;
  description: string;
  sortOrder: number;
};

/** Onboard crew designations from the RBAC role catalog (`userType: vessel`). */
export const VESSEL_CREW_ROLES: VesselCrewRoleOption[] = SYSTEM_ROLES.filter(
  (role) => role.userType === "vessel",
)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((role) => ({
    roleCode: role.code,
    designation: role.designation,
    department: role.department,
    description: role.jobScope,
    sortOrder: role.sortOrder,
  }));

export function getVesselCrewRole(roleCode: string): VesselCrewRoleOption | undefined {
  return VESSEL_CREW_ROLES.find((role) => role.roleCode === roleCode);
}

export function isVesselCrewRoleCode(roleCode: string): boolean {
  return VESSEL_CREW_ROLES.some((role) => role.roleCode === roleCode);
}
