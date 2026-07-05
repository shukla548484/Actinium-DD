import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  SEED_ADMIN_LOGIN_ID,
  SEED_ADMIN_PASSWORD,
  SEED_ADMIN_ROLE_NO,
} from "@/lib/auth/constants";
import { createUserForEmployee, syncUserRoleForEmployee } from "@/lib/db/employeeAuth";

const notDeleted = { deletedAt: null };

export type SeedAdminResult = {
  loginId: string;
  password: string;
  roleNo: number;
  roleCode: string;
  created: boolean;
};

/** Idempotent — ensures ACT.1001 system administrator (Role ID 1001). */
export async function ensureSeedAdminUser(): Promise<SeedAdminResult> {
  const sysAdminRole = await prisma.role.findFirst({
    where: { roleNo: SEED_ADMIN_ROLE_NO, organizationId: null, ...notDeleted },
  });
  if (!sysAdminRole) {
    throw new Error(`System role ${SEED_ADMIN_ROLE_NO} (SYS_ADMIN) not found — run seedRbacCatalog first.`);
  }

  let company = await prisma.company.findFirst({
    where: { code: "ACT", ...notDeleted },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        code: "ACT",
        name: "Actinium Platform",
        type: "MASTER",
        category: "other",
        status: "active",
        isShipowner: true,
      },
    });
  }

  const email = "admin@actinium.local";
  let employee = await prisma.employee.findFirst({
    where: { employeeCode: SEED_ADMIN_LOGIN_ID, ...notDeleted },
    include: { user: true, role: true },
  });

  let created = false;

  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: SEED_ADMIN_LOGIN_ID,
        firstName: "System",
        lastName: "Administrator",
        email,
        designation: "Platform Administrator",
        department: "IT",
        status: "active",
        roleId: sysAdminRole.id,
      },
      include: { user: true, role: true },
    });
    created = true;
  } else if (employee.roleId !== sysAdminRole.id) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { roleId: sysAdminRole.id, status: "active" },
    });
  }

  if (!employee.userId || !employee.user) {
    const user = await createUserForEmployee({
      employeeCode: SEED_ADMIN_LOGIN_ID,
      email,
      firstName: "System",
      lastName: "Administrator",
      roleId: sysAdminRole.id,
      companyId: company.id,
      password: SEED_ADMIN_PASSWORD,
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { loginId: SEED_ADMIN_LOGIN_ID, status: "active" },
    });
    created = true;
  } else {
    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        loginId: SEED_ADMIN_LOGIN_ID,
        passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
        status: "active",
        displayName: "System Administrator",
      },
    });
    await syncUserRoleForEmployee(employee.userId, sysAdminRole.id, company.id);
  }

  return {
    loginId: SEED_ADMIN_LOGIN_ID,
    password: SEED_ADMIN_PASSWORD,
    roleNo: SEED_ADMIN_ROLE_NO,
    roleCode: sysAdminRole.code,
    created,
  };
}
