import {
  SuperintendentMobileNav,
  SuperintendentSidebar,
} from "@/components/superintendent/SuperintendentSidebar";
import { SuperintendentScopeBar } from "@/components/superintendent/SuperintendentScopeBar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export default async function SuperintendentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/superintendent";
  await enforceOfficePageAccess(pathname);

  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <SuperintendentScopeBar />
        <SuperintendentMobileNav />
      </div>
      <div className="dd-module-row">
        <SuperintendentSidebar />
        <ModuleScrollArea>{children}</ModuleScrollArea>
      </div>
    </div>
  );
}
