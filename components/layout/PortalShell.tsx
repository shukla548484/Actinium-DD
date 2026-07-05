"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { RbacUserType } from "@prisma/client";
import { AppFooter } from "@/components/layout/AppFooter";
import { isSidebarModulePath } from "@/components/layout/ModuleScrollArea";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { buildCrewTopNavItems } from "@/lib/navigation/buildCrewNav";
import {
  buildTopNavForUserType,
  portalHomeHrefForUserType,
  resolveActiveNavIdForUserType,
} from "@/lib/navigation/buildPortalNav";
import { resolveCrewActiveNavId } from "@/lib/navigation/crewNavItems";
import type { TopNavItem } from "@/lib/navigation/topNavItems";
import { rbacUserTypeLabel } from "@/lib/rbac/userTypes";

type SessionUser = {
  displayName: string;
  loginId: string | null;
  employeeCode: string | null;
  designation: string | null;
  vesselLoginId: string | null;
  officeBootstrap: boolean;
  isVesselCrew: boolean;
  rbacUserType?: RbacUserType;
  rbacUserTypeLabel?: string;
  portalHome?: string;
  roleName: string | null;
  vessels: { id: string; code: string; name: string }[];
  assignedPageKeys: string[];
};

function SimpleScrollPage({
  children,
  compactFooter,
}: {
  children: React.ReactNode;
  compactFooter?: boolean;
}) {
  return (
    <main className="dd-content-scroll bg-background">
      {children}
      <AppFooter compact={compactFooter} />
    </main>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isYardPortal = pathname.startsWith("/quote/");
  const isLogin = pathname.startsWith("/login");
  const isPortalHub = pathname === "/";
  const isSidebarModule = isSidebarModulePath(pathname);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [portalNavItems, setPortalNavItems] = useState<TopNavItem[] | undefined>(undefined);

  useEffect(() => {
    if (isYardPortal || isLogin || isPortalHub) return;
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          const user = data.user as SessionUser;
          setSessionUser(user);
          const userType = user.rbacUserType ?? (user.isVesselCrew ? "vessel" : "office");
          if (userType === "vessel") {
            setPortalNavItems(buildCrewTopNavItems(user.assignedPageKeys ?? []));
          } else {
            setPortalNavItems(buildTopNavForUserType(userType));
          }
        }
      })
      .catch(() => {});
  }, [isYardPortal, isLogin, isPortalHub, pathname]);

  const userType = useMemo<RbacUserType>(() => {
    if (sessionUser?.rbacUserType) return sessionUser.rbacUserType;
    if (sessionUser?.isVesselCrew) return "vessel";
    return "office";
  }, [sessionUser]);

  useEffect(() => {
    if (
      isYardPortal ||
      isLogin ||
      isPortalHub ||
      userType === "vessel" ||
      userType === "shipyard" ||
      userType === "external"
    ) {
      return;
    }
    void fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const projects = (data.projects ?? []) as Array<{ status: string }>;
        setPendingTasks(
          projects.filter((p) => p.status === "tendering" || p.status === "comparing").length,
        );
      })
      .catch(() => {});
  }, [isYardPortal, isLogin, isPortalHub, pathname, userType]);

  if (isYardPortal || isLogin || isPortalHub) {
    if (isLogin) {
      return <>{children}</>;
    }
    return (
      <div className="dd-portal-root">
        <SimpleScrollPage compactFooter={isLogin}>{children}</SimpleScrollPage>
      </div>
    );
  }

  const isCrew = userType === "vessel";
  const userName = sessionUser?.displayName ?? "Office User";
  const assignedVessel = sessionUser?.vessels[0];
  const userRole = isCrew
    ? [
        sessionUser?.designation ?? sessionUser?.roleName,
        sessionUser?.vesselLoginId ?? sessionUser?.loginId,
        assignedVessel ? `${assignedVessel.name} (${assignedVessel.code})` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : [
        sessionUser?.designation ?? sessionUser?.roleName,
        sessionUser?.rbacUserTypeLabel ?? rbacUserTypeLabel(userType),
        sessionUser?.loginId ? `ID ${sessionUser.loginId}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const homeHref = sessionUser?.portalHome ?? portalHomeHrefForUserType(userType);
  const showOfficeChrome = userType === "office" || userType === "system";

  return (
    <div className="dd-portal-root">
      <TopNavBar
        companyName="Actinium-DD"
        userName={userName}
        userRole={userRole}
        pendingTasksCount={pendingTasks}
        activeNav={
          isCrew ? resolveCrewActiveNavId(pathname) : resolveActiveNavIdForUserType(pathname, userType)
        }
        navItems={portalNavItems}
        homeHref={homeHref}
        showTasksPending={showOfficeChrome}
        showSearch={false}
      />
      {isSidebarModule ? (
        <div className="dd-app-body">{children}</div>
      ) : (
        <SimpleScrollPage>{children}</SimpleScrollPage>
      )}
    </div>
  );
}
