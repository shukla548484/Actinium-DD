"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppFooter } from "@/components/layout/AppFooter";
import { isSidebarModulePath } from "@/components/layout/ModuleScrollArea";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { resolveActiveNavId } from "@/lib/navigation/topNavItems";

type SessionUser = {
  displayName: string;
  loginId: string | null;
  employeeCode: string | null;
  designation: string | null;
  officeBootstrap: boolean;
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
  const isSidebarModule = isSidebarModulePath(pathname);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (isYardPortal || isLogin) return;
    void fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const projects = (data.projects ?? []) as Array<{ status: string }>;
        setPendingTasks(
          projects.filter((p) => p.status === "tendering" || p.status === "comparing").length,
        );
      })
      .catch(() => {});
  }, [isYardPortal, isLogin, pathname]);

  useEffect(() => {
    if (isYardPortal || isLogin) return;
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setSessionUser(data.user as SessionUser);
      })
      .catch(() => {});
  }, [isYardPortal, isLogin, pathname]);

  if (isYardPortal || isLogin) {
    return (
      <div className="dd-portal-root">
        <SimpleScrollPage compactFooter>{children}</SimpleScrollPage>
      </div>
    );
  }

  const userName = sessionUser?.displayName ?? "Office User";
  const userRole =
    sessionUser?.designation ??
    (sessionUser?.loginId ? `Employee ID ${sessionUser.loginId}` : "Actinium-DD portal");

  return (
    <div className="dd-portal-root">
      <TopNavBar
        companyName="Actinium-DD"
        userName={userName}
        userRole={userRole}
        pendingTasksCount={pendingTasks}
        activeNav={resolveActiveNavId(pathname)}
        showChangePassword={Boolean(sessionUser?.loginId && !sessionUser.officeBootstrap)}
      />
      {isSidebarModule ? (
        <div className="dd-app-body">{children}</div>
      ) : (
        <SimpleScrollPage>{children}</SimpleScrollPage>
      )}
    </div>
  );
}
