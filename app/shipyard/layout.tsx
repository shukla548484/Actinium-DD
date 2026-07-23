import { ShipyardMobileNav, ShipyardSidebar } from "@/components/shipyard/ShipyardSidebar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export default async function ShipyardLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "/shipyard";
  const isTokenPortal = /^\/shipyard\/quotations\/t\//.test(pathname);

  if (isTokenPortal) {
    return <>{children}</>;
  }

  await enforceOfficePageAccess(pathname);

  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <ShipyardMobileNav />
      </div>
      <div className="dd-module-row">
        <ShipyardSidebar />
        <ModuleScrollArea>{children}</ModuleScrollArea>
      </div>
    </div>
  );
}
