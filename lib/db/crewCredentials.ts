import type { EntityStatus } from "@prisma/client";
import { nextVesselCrewLoginId } from "@/lib/admin/crewLoginId";
import { getVesselCrewRole, VESSEL_CREW_ROLES } from "@/lib/admin/vesselCrewRoles";
import { formatEmployeeCode } from "@/lib/admin/codes";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { getDesignationByLabel } from "@/lib/admin/designations";
import {
  assignVesselsToEmployee,
  deleteEmployee,
  getEmployee,
  prepareEmailForRegistration,
} from "@/lib/db/employees";
import {
  resetEmployeePassword,
  updateEmployeeUserProfile,
} from "@/lib/db/employeeAuth";
import { prisma } from "@/lib/prisma";
import { getRoleByCode } from "@/lib/db/rbac";
import { assignDefaultCrewPageAccess } from "@/lib/db/crewPageAccess";

const notDeleted = { deletedAt: null };

export type CrewCredentialSlotDto = {
  roleCode: string;
  designation: string;
  department: string;
  description: string;
  assignments: {
    employeeId: string;
    employeeCode: string;
    name: string;
    loginId: string;
    vesselLoginId: string | null;
    status: string;
    isWatchKeeper: boolean;
  }[];
};

export type CrewCredentialsContextDto = {
  vessel: {
    id: string;
    code: string;
    name: string;
    companyId: string;
    companyName: string;
    companyCode: string;
    status: string;
  };
  roles: CrewCredentialSlotDto[];
};

function mapAssignment(
  ev: {
    isWatchKeeper: boolean;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      designation: string | null;
      status: string;
      role: { code: string } | null;
      user: { loginId: string | null } | null;
      vesselLoginId: string | null;
    };
  },
  roleCode: string,
) {
  const employee = ev.employee;
  const matchesRole =
    employee.role?.code === roleCode ||
    getVesselCrewRole(roleCode)?.designation === employee.designation;
  if (!matchesRole) return null;

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    name: `${employee.firstName} ${employee.lastName}`,
    loginId: employee.user?.loginId ?? employee.employeeCode,
    vesselLoginId: employee.vesselLoginId,
    status: employee.status,
    isWatchKeeper: ev.isWatchKeeper,
  };
}

async function nextEmployeeCode(companyId: string): Promise<string> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, ...notDeleted },
    select: { code: true },
  });
  if (!company) throw new Error("Company not found");

  const count = await prisma.employee.count({ where: { companyId } });
  let seq = count + 1;
  let code = formatEmployeeCode(company.code, seq);
  while (await prisma.employee.findFirst({ where: { employeeCode: code } })) {
    seq++;
    code = formatEmployeeCode(company.code, seq);
  }
  return code;
}

async function assertEmailAvailable(email: string) {
  await prepareEmailForRegistration(email);
}

export async function getCrewCredentialsContext(
  vesselId: string,
): Promise<CrewCredentialsContextDto | null> {
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    include: {
      company: { select: { id: true, name: true, code: true } },
    },
  });
  if (!vessel) return null;

  const employeeVessels = await prisma.employeeVessel.findMany({
    where: {
      vesselId,
      employee: { ...notDeleted },
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          status: true,
          role: { select: { code: true } },
          user: { select: { loginId: true } },
          vesselLoginId: true,
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  const roles: CrewCredentialSlotDto[] = VESSEL_CREW_ROLES.map((role) => ({
    roleCode: role.roleCode,
    designation: role.designation,
    department: role.department,
    description: role.description,
    assignments: employeeVessels
      .map((ev) => mapAssignment(ev, role.roleCode))
      .filter((row): row is NonNullable<typeof row> => row != null),
  }));

  return {
    vessel: {
      id: vessel.id,
      code: vessel.code,
      name: vessel.name,
      companyId: vessel.companyId,
      companyName: vessel.company.name,
      companyCode: vessel.company.code,
      status: vessel.status,
    },
    roles,
  };
}

export async function createVesselCrewCredential(
  vesselId: string,
  input: {
    roleCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isWatchKeeper?: boolean;
  },
) {
  const crewRole = getVesselCrewRole(input.roleCode);
  if (!crewRole) {
    throw new Error("Invalid crew designation selected");
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, status: "active", ...notDeleted },
    select: { id: true, companyId: true, code: true },
  });
  if (!vessel) {
    throw new Error("Vessel not found or inactive");
  }

  await assertEmailAvailable(input.email);

  const role = await getRoleByCode(input.roleCode);
  const roleId = role?.id ?? null;
  const employeeCode = await nextEmployeeCode(vessel.companyId);
  const vesselLoginId = await nextVesselCrewLoginId(vesselId, vessel.code, input.roleCode);

  const designationSeed = getDesignationByLabel(crewRole.designation);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        loginId: employeeCode,
        email: input.email.trim().toLowerCase(),
        displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
        passwordHash: hashPassword(DEFAULT_EMPLOYEE_PASSWORD),
        status: "active",
        ...(roleId
          ? {
              userRoles: {
                create: {
                  roleId,
                  scopeType: "vessel",
                  scopeId: vesselId,
                },
              },
            }
          : {}),
      },
    });

    await tx.employee.create({
      data: {
        companyId: vessel.companyId,
        employeeCode,
        vesselLoginId: vesselLoginId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        designation: designationSeed?.label ?? crewRole.designation,
        department: crewRole.department,
        roleId,
        userId: user.id,
        status: "wait",
      },
    });
  });

  const created = await prisma.employee.findFirst({
    where: { employeeCode, ...notDeleted },
    select: { id: true },
  });
  if (!created) throw new Error("Failed to create crew employee");

  await assignVesselsToEmployee(
    created.id,
    [vesselId],
    input.isWatchKeeper ? [vesselId] : [],
  );

  await assignDefaultCrewPageAccess(created.id);

  return getEmployee(created.id);
}

export type CrewCredentialDetailDto = {
  employeeId: string;
  employeeCode: string;
  loginId: string;
  vesselLoginId: string;
  roleCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  status: EntityStatus;
  isWatchKeeper: boolean;
};

async function assertEmailAvailableForCrew(email: string, excludeEmployeeId?: string) {
  await prepareEmailForRegistration(email, excludeEmployeeId);
}

async function syncCrewVesselUserRole(
  userId: string,
  roleId: string | null,
  vesselId: string,
) {
  await prisma.userRole.deleteMany({
    where: { userId, scopeType: "vessel", scopeId: vesselId },
  });
  if (roleId) {
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
        scopeType: "vessel",
        scopeId: vesselId,
      },
    });
  }
}

function resolveCrewRoleCode(employee: {
  designation: string | null;
  role: { code: string } | null;
}): string | null {
  if (employee.role?.code && getVesselCrewRole(employee.role.code)) {
    return employee.role.code;
  }
  return (
    VESSEL_CREW_ROLES.find((role) => role.designation === employee.designation)?.roleCode ??
    null
  );
}

function isVesselCrewEmployee(employee: {
  designation: string | null;
  role: { code: string } | null;
}): boolean {
  return resolveCrewRoleCode(employee) != null;
}

async function loadCrewCredentialRow(vesselId: string, employeeId: string) {
  const assignment = await prisma.employeeVessel.findFirst({
    where: {
      vesselId,
      employeeId,
      employee: { ...notDeleted },
    },
    include: {
      employee: {
        include: {
          role: { select: { code: true } },
          user: { select: { id: true, loginId: true } },
        },
      },
    },
  });

  if (!assignment || !isVesselCrewEmployee(assignment.employee)) return null;
  return assignment;
}

export async function getCrewCredentialDetail(
  vesselId: string,
  employeeId: string,
): Promise<CrewCredentialDetailDto | null> {
  const assignment = await loadCrewCredentialRow(vesselId, employeeId);
  if (!assignment) return null;

  const employee = assignment.employee;
  const roleCode = resolveCrewRoleCode(employee);

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    loginId: employee.user?.loginId ?? employee.employeeCode,
    vesselLoginId: employee.vesselLoginId ?? "",
    roleCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    designation: employee.designation ?? "",
    department: employee.department ?? "",
    status: employee.status,
    isWatchKeeper: assignment.isWatchKeeper,
  };
}

export async function updateVesselCrewCredential(
  vesselId: string,
  employeeId: string,
  input: {
    roleCode?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    isWatchKeeper?: boolean;
    status?: EntityStatus;
    resetPassword?: boolean;
  },
) {
  const assignment = await loadCrewCredentialRow(vesselId, employeeId);
  if (!assignment) {
    throw new Error("Crew credential not found on this vessel");
  }

  const employee = assignment.employee;
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: { code: true },
  });
  if (!vessel) {
    throw new Error("Vessel not found");
  }

  if (input.email != null) {
    await assertEmailAvailableForCrew(input.email, employeeId);
  }

  const currentRoleCode = resolveCrewRoleCode(employee);

  let nextRoleCode = currentRoleCode;
  let crewRole = currentRoleCode ? getVesselCrewRole(currentRoleCode) : undefined;
  let roleId = employee.roleId;

  if (input.roleCode != null && input.roleCode !== currentRoleCode) {
    const nextCrewRole = getVesselCrewRole(input.roleCode);
    if (!nextCrewRole) {
      throw new Error("Invalid crew designation selected");
    }
    nextRoleCode = input.roleCode;
    crewRole = nextCrewRole;
    const role = await getRoleByCode(input.roleCode);
    roleId = role?.id ?? null;
  }

  let vesselLoginId = employee.vesselLoginId;
  const roleForLoginId = nextRoleCode ?? currentRoleCode;
  if (
    !vesselLoginId &&
    roleForLoginId
  ) {
    vesselLoginId = await nextVesselCrewLoginId(vesselId, vessel.code, roleForLoginId);
  } else if (input.roleCode != null && input.roleCode !== currentRoleCode && nextRoleCode) {
    vesselLoginId = await nextVesselCrewLoginId(vesselId, vessel.code, nextRoleCode);
  }

  const designationSeed = crewRole ? getDesignationByLabel(crewRole.designation) : null;

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.firstName != null ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName != null ? { lastName: input.lastName.trim() } : {}),
        ...(input.email != null ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.phone != null ? { phone: input.phone.trim() } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(crewRole
          ? {
              designation: designationSeed?.label ?? crewRole.designation,
              department: crewRole.department,
              roleId,
              vesselLoginId,
            }
          : {}),
      },
    });

    if (input.isWatchKeeper != null) {
      await tx.employeeVessel.update({
        where: {
          employeeId_vesselId: { employeeId, vesselId },
        },
        data: { isWatchKeeper: input.isWatchKeeper },
      });
    }
  });

  if (employee.user?.id) {
    await updateEmployeeUserProfile(employee.user.id, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      employeeStatus: input.status,
    });

    if (input.roleCode != null && roleId !== undefined) {
      await syncCrewVesselUserRole(employee.user.id, roleId, vesselId);
    }
  }

  if (input.resetPassword) {
    await resetEmployeePassword(employeeId);
  }

  return getCrewCredentialDetail(vesselId, employeeId);
}

export async function deleteVesselCrewCredential(vesselId: string, employeeId: string) {
  const assignment = await loadCrewCredentialRow(vesselId, employeeId);
  if (!assignment) {
    throw new Error("Crew credential not found on this vessel");
  }

  await prisma.employeeVessel.deleteMany({
    where: { vesselId, employeeId },
  });

  await deleteEmployee(employeeId);
}
