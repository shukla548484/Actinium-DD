import type { EntityStatus, RbacUserType } from "@prisma/client";
import { isVesselCrewRoleCode } from "@/lib/admin/crewLoginId";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { hashPassword, verifyPasswordHash } from "@/lib/auth/password";
import { resolveRbacUserTypeFromRole } from "@/lib/rbac/userTypes";
import { prisma } from "@/lib/prisma";

const notDeleted = { deletedAt: null };

export type EmployeeLoginUser = {
  userId: string;
  loginId: string;
  vesselLoginId: string | null;
  displayName: string;
  email: string;
  employeeId: string | null;
  employeeCode: string | null;
  designation: string | null;
  isVesselCrew: boolean;
  rbacUserType: RbacUserType;
  roleCode: string | null;
};

function isVesselCrewRole(role: { code: string; userType: string } | null | undefined) {
  return role?.userType === "vessel" || isVesselCrewRoleCode(role?.code);
}

export async function createUserForEmployee(input: {
  employeeCode: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  companyId: string;
  password?: string;
}) {
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`;
  const passwordHash = hashPassword(input.password ?? DEFAULT_EMPLOYEE_PASSWORD);

  return prisma.user.create({
    data: {
      loginId: input.employeeCode,
      email: input.email.trim().toLowerCase(),
      displayName,
      passwordHash,
      status: "active",
      userRoles: input.roleId
        ? {
            create: {
              roleId: input.roleId,
              scopeType: "organization",
              scopeId: input.companyId,
            },
          }
        : undefined,
    },
  });
}

export async function syncUserRoleForEmployee(
  userId: string,
  roleId: string | null,
  companyId: string,
) {
  await prisma.userRole.deleteMany({ where: { userId } });
  if (!roleId) return;
  await prisma.userRole.create({
    data: {
      userId,
      roleId,
      scopeType: "organization",
      scopeId: companyId,
    },
  });
}

export async function verifyEmployeeLogin(
  loginId: string,
  password: string,
): Promise<EmployeeLoginUser | null> {
  const trimmed = loginId.trim();
  if (!trimmed || !password) return null;

  const includeProfile = {
    employeeProfile: {
      select: {
        id: true,
        employeeCode: true,
        vesselLoginId: true,
        designation: true,
        status: true,
        deletedAt: true,
        role: { select: { code: true, userType: true } },
      },
    },
  } as const;

  const loginCandidates = [trimmed, trimmed.toUpperCase()];

  const userByVesselLogin = await prisma.user.findFirst({
    where: {
      ...notDeleted,
      employeeProfile: {
        is: {
          ...notDeleted,
          vesselLoginId: { in: [...new Set(loginCandidates)] },
        },
      },
    },
    include: includeProfile,
  });

  const userByLoginId = await prisma.user.findFirst({
    where: {
      ...notDeleted,
      loginId: { in: [...new Set(loginCandidates)] },
    },
    include: includeProfile,
  });

  const userByEmployeeCode = await prisma.user.findFirst({
    where: {
      ...notDeleted,
      employeeProfile: { is: { employeeCode: trimmed, ...notDeleted } },
    },
    include: includeProfile,
  });

  let user = userByVesselLogin;
  let matchedViaEmployeeCode = false;

  if (!user && userByLoginId) {
    if (isVesselCrewRole(userByLoginId.employeeProfile?.role)) {
      return null;
    }
    user = userByLoginId;
  }

  if (!user && userByEmployeeCode) {
    if (isVesselCrewRole(userByEmployeeCode.employeeProfile?.role)) {
      return null;
    }
    user = userByEmployeeCode;
    matchedViaEmployeeCode = true;
  }

  if (!user || user.status === "disabled") return null;
  if (!verifyPasswordHash(password, user.passwordHash)) return null;

  const employee =
    user.employeeProfile && !user.employeeProfile.deletedAt ? user.employeeProfile : null;
  if (employee && employee.status === "inactive") return null;

  const vesselCrew = isVesselCrewRole(employee?.role ?? null);
  if (vesselCrew && matchedViaEmployeeCode) return null;

  const resolvedLoginId = user.loginId ?? employee?.employeeCode ?? trimmed;
  const rbacUserType = resolveRbacUserTypeFromRole(employee?.role ?? null);

  return {
    userId: user.id,
    loginId: resolvedLoginId,
    vesselLoginId: employee?.vesselLoginId ?? null,
    displayName: user.displayName,
    email: user.email,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employeeCode ?? null,
    designation: employee?.designation ?? null,
    isVesselCrew: vesselCrew,
    rbacUserType,
    roleCode: employee?.role?.code ?? null,
  };
}

export async function getUserById(userId: string): Promise<EmployeeLoginUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...notDeleted },
    include: {
      employeeProfile: {
        select: {
          id: true,
          employeeCode: true,
          vesselLoginId: true,
          designation: true,
          status: true,
          deletedAt: true,
          role: { select: { code: true, userType: true } },
        },
      },
    },
  });
  if (!user) return null;

  const employee =
    user.employeeProfile && !user.employeeProfile.deletedAt ? user.employeeProfile : null;
  const role = employee?.role ?? null;
  const rbacUserType = resolveRbacUserTypeFromRole(role);
  return {
    userId: user.id,
    loginId: user.loginId ?? employee?.employeeCode ?? user.id,
    vesselLoginId: employee?.vesselLoginId ?? null,
    displayName: user.displayName,
    email: user.email,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employeeCode ?? null,
    designation: employee?.designation ?? null,
    isVesselCrew: isVesselCrewRole(role),
    rbacUserType,
    roleCode: role?.code ?? null,
  };
}

export async function changeUserPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...notDeleted },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new Error("User not found");

  if (currentPassword != null && !verifyPasswordHash(currentPassword, user.passwordHash)) {
    throw new Error("Current password is incorrect");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(newPassword) },
  });
}

export async function resetEmployeePassword(employeeId: string, newPassword?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ...notDeleted },
    select: {
      userId: true,
      employeeCode: true,
      vesselLoginId: true,
      user: { select: { loginId: true } },
    },
  });
  if (!employee?.userId) {
    throw new Error("Employee has no login account. Re-save the employee profile to create one.");
  }

  await changeUserPassword(employee.userId, newPassword ?? DEFAULT_EMPLOYEE_PASSWORD);
  return {
    loginId: employee.user?.loginId ?? employee.employeeCode,
    vesselLoginId: employee.vesselLoginId,
  };
}

export async function ensureEmployeeLoginAccount(employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ...notDeleted },
    include: { user: true },
  });
  if (!employee) throw new Error("Employee not found");
  if (employee.userId && employee.user) {
    return {
      userId: employee.userId,
      loginId: employee.user.loginId ?? employee.employeeCode,
      created: false,
    };
  }

  const user = await createUserForEmployee({
    employeeCode: employee.employeeCode,
    email: employee.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
    roleId: employee.roleId,
    companyId: employee.companyId,
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data: { userId: user.id },
  });

  return { userId: user.id, loginId: employee.employeeCode, created: true };
}

export async function updateEmployeeUserProfile(
  userId: string,
  input: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    roleId: string | null;
    companyId: string;
    employeeStatus: EntityStatus;
  }>,
) {
  const data: {
    email?: string;
    displayName?: string;
    status?: "active" | "disabled" | "invited";
  } = {};

  if (input.email != null) data.email = input.email.trim().toLowerCase();
  if (input.firstName != null && input.lastName != null) {
    data.displayName = `${input.firstName.trim()} ${input.lastName.trim()}`;
  }
  if (input.employeeStatus === "inactive") {
    data.status = "disabled";
  } else if (input.employeeStatus === "active" || input.employeeStatus === "wait") {
    data.status = "active";
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }

  if (input.roleId !== undefined && input.companyId) {
    await syncUserRoleForEmployee(userId, input.roleId, input.companyId);
  }
}
