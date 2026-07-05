import { ShipAccessNav } from "@/components/shipAccess/ShipAccessNav";
import { CrewPageGuard } from "@/components/shipAccess/CrewPageGuard";
import { ShipAccessScopeBar } from "@/components/shipAccess/ShipAccessScopeBar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";

export default function ShipAccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <ShipAccessScopeBar />
        <ShipAccessNav />
      </div>
      <ModuleScrollArea>
        <CrewPageGuard>{children}</CrewPageGuard>
      </ModuleScrollArea>
    </div>
  );
}
