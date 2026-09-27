import { NextResponse } from "next/server";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { getUserById } from "@/lib/db/employeeAuth";
import { getSessionPayload } from "@/lib/auth/session";
import { portalHomeForUserType, rbacUserTypeLabel } from "@/lib/rbac/userTypes";
import {
  getEmployeeAssignedModuleCodes,
  getEffectiveEmployeePageKeys,
} from "@/lib/db/employeeModuleAccess";
import { moduleCodeForPageKey } from "@/lib/rbac/accessModules";
import { getUserPermissions } from "@/lib/db/rbac";
import { withMachineryRegisterPage } from "@/lib/shipAccess/crewPages";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (payload.officeBootstrap) {
    return NextResponse.json({
      authenticated: true,
      user: {
        displayName: "Office User",
        loginId: null,
        employeeCode: null,
        officeBootstrap: true,
        isVesselCrew: false,
        rbacUserType: "office",
        rbacUserTypeLabel: rbacUserTypeLabel("office"),
        portalHome: portalHomeForUserType("office"),
        assignedPageKeys: [],
        assignedModuleCodes: [],
        moduleAccessUnrestricted: false,
      },
    });
  }

  if (!payload.userId) {
    return NextResponse.json({ authenticated: true, user: null });
  }

  const [user, crewContext, permissions] = await Promise.all([
    getUserById(payload.userId),
    getCrewSessionContext(),
    getUserPermissions(payload.userId),
  ]);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const unrestricted =
    permissions.has("platform.tenant.manage") ||
    permissions.has("*") ||
    user.roleCode === "SYS_ADMIN";

  const employeeId = crewContext?.employeeId ?? user.employeeId;
  let assignedPageKeys = crewContext?.assignedPageKeys ?? [];
  let assignedModuleCodes: string[] = [];

  if (employeeId && !unrestricted) {
    const [modules, pages] = await Promise.all([
      getEmployeeAssignedModuleCodes(employeeId),
      getEffectiveEmployeePageKeys(employeeId),
    ]);
    assignedModuleCodes = modules;
    if (pages.length > 0) assignedPageKeys = pages;
  }

  // Role fallback: office users often have role permissions but no explicit
  // employee module rows yet — derive modules/pages so the top nav is usable.
  if (!unrestricted && assignedModuleCodes.length === 0) {
    const rolePageKeys = [...permissions].filter((key) => key.startsWith("page."));
    if (rolePageKeys.length > 0) {
      assignedPageKeys = rolePageKeys;
      const derived = new Set<string>();
      for (const key of rolePageKeys) {
        const code = moduleCodeForPageKey(key);
        if (code) derived.add(code);
      }
      assignedModuleCodes = [...derived].sort();
    }
  }

  assignedPageKeys = withMachineryRegisterPage(assignedPageKeys);

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: user.userId,
      displayName: user.displayName,
      loginId: user.loginId,
      employeeCode: user.employeeCode,
      email: user.email,
      designation: user.designation,
      vesselLoginId: user.vesselLoginId,
      officeBootstrap: false,
      isVesselCrew: crewContext?.isVesselCrew ?? user.isVesselCrew,
      rbacUserType: user.rbacUserType,
      rbacUserTypeLabel: rbacUserTypeLabel(user.rbacUserType),
      portalHome: portalHomeForUserType(user.rbacUserType),
      roleCode: crewContext?.roleCode ?? user.roleCode,
      roleName: crewContext?.roleName ?? null,
      employeeId,
      vessels: crewContext?.vessels ?? [],
      primaryVesselId: crewContext?.primaryVesselId ?? null,
      allowedJobCategories: crewContext?.allowedJobCategories ?? [],
      assignedPageKeys,
      assignedModuleCodes,
      moduleAccessUnrestricted: unrestricted,
    },
  });
}
