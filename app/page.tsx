import { redirect } from "next/navigation";
import { PortalHub } from "@/components/auth/PortalHub";
import { getPortalUserTypeFromPayload } from "@/lib/auth/portalAccess";
import { getSessionPayload, isAuthEnabled } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/employeeAuth";
import { portalHomeForUserType } from "@/lib/rbac/userTypes";

export default async function Home() {
  const payload = await getSessionPayload();

  if (isAuthEnabled()) {
    if (!payload?.userId && !payload?.officeBootstrap) {
      redirect("/login");
    }
    const userType = await getPortalUserTypeFromPayload(payload, async (userId) => {
      const user = await getUserById(userId);
      return user?.roleCode
        ? { code: user.roleCode, userType: user.rbacUserType }
        : null;
    });
    redirect(portalHomeForUserType(userType));
  }

  if (payload?.userId || payload?.officeBootstrap) {
    const userType = await getPortalUserTypeFromPayload(payload, async (userId) => {
      const user = await getUserById(userId);
      return user?.roleCode
        ? { code: user.roleCode, userType: user.rbacUserType }
        : null;
    });
    redirect(portalHomeForUserType(userType));
  }

  return <PortalHub />;
}
