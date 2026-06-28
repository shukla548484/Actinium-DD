import { ShipAccessScopeBar } from "@/components/shipAccess/ShipAccessScopeBar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";

export default function ShipAccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <ShipAccessScopeBar />
      </div>
      <ModuleScrollArea>{children}</ModuleScrollArea>
    </div>
  );
}
