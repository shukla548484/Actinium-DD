import type { EntityStatus } from "@prisma/client";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { hashPassword, verifyPasswordHash } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const notDeleted = { deletedAt: null };

export type EmployeeLoginUser = {
  userId: string;
  loginId: string;
  displayName: string;
  email: string;
  employeeId: string | null;
  employeeCode: string | null;
  designation: string | null;
};

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

  const user = await prisma.user.findFirst({
    where: {
      ...notDeleted,
      OR: [
        { loginId: trimmed },
        { employeeProfile: { is: { employeeCode: trimmed, ...notDeleted } } },
      ],
    },
    include: {
      employeeProfile: {
        select: {
          id: true,
          employeeCode: true,
          designation: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!user || user.status === "disabled") return null;
  if (!verifyPasswordHash(password, user.passwordHash)) return null;

  const employee =
    user.employeeProfile && !user.employeeProfile.deletedAt ? user.employeeProfile : null;
  if (employee && employee.status === "inactive") return null;

  return {
    userId: user.id,
    loginId: user.loginId ?? employee?.employeeCode ?? trimmed,
    displayName: user.displayName,
    email: user.email,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employeeCode ?? user.loginId,
    designation: employee?.designation ?? null,
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
          designation: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!user) return null;

  const employee =
    user.employeeProfile && !user.employeeProfile.deletedAt ? user.employeeProfile : null;
  return {
    userId: user.id,
    loginId: user.loginId ?? employee?.employeeCode ?? user.id,
    displayName: user.displayName,
    email: user.email,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employeeCode ?? null,
    designation: employee?.designation ?? null,
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
    select: { userId: true, employeeCode: true },
  });
  if (!employee?.userId) {
    throw new Error("Employee has no login account. Re-save the employee profile to create one.");
  }

  await changeUserPassword(employee.userId, newPassword ?? DEFAULT_EMPLOYEE_PASSWORD);
  return { loginId: employee.employeeCode };
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
