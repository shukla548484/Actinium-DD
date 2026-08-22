import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { getSessionUserId } from "@/lib/auth/session";
import { buildAuthContext, can } from "@/lib/db/rbac";
import { redirect } from "next/navigation";
import { portalHomeForUserType } from "@/lib/rbac/userTypes";
import { getUserById } from "@/lib/db/employeeAuth";

export const dynamic = "force-dynamic";

/**
 * Office department dashboards are admin monitor surfaces —
 * not for individual roles such as TECH_SUPDT.
 */
export default async function OfficeDepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceOfficePageAccess("/office");

  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [auth, user] = await Promise.all([
    buildAuthContext(userId),
    getUserById(userId),
  ]);

  const isAdmin =
    Boolean(auth) &&
    (can(auth, "platform.tenant.manage") ||
      can(auth, "*") ||
      can(auth, "page.office.admin") ||
      auth!.roleCodes.includes("SYS_ADMIN") ||
      auth!.roleCodes.includes("COMP_ADMIN"));

  if (!isAdmin) {
    redirect(portalHomeForUserType(user?.rbacUserType ?? "office"));
  }

  return children;
}
