import { NextResponse } from "next/server";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { getUserById } from "@/lib/db/employeeAuth";
import { getSessionPayload } from "@/lib/auth/session";
import { portalHomeForUserType, rbacUserTypeLabel } from "@/lib/rbac/userTypes";

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
      },
    });
  }

  if (!payload.userId) {
    return NextResponse.json({ authenticated: true, user: null });
  }

  const [user, crewContext] = await Promise.all([
    getUserById(payload.userId),
    getCrewSessionContext(),
  ]);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

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
      employeeId: crewContext?.employeeId ?? user.employeeId,
      vessels: crewContext?.vessels ?? [],
      primaryVesselId: crewContext?.primaryVesselId ?? null,
      allowedJobCategories: crewContext?.allowedJobCategories ?? [],
      assignedPageKeys: crewContext?.assignedPageKeys ?? [],
    },
  });
}
