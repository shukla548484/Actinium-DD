import { ShipyardMobileNav, ShipyardSidebar } from "@/components/shipyard/ShipyardSidebar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";

export default function ShipyardLayout({ children }: { children: React.ReactNode }) {
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
