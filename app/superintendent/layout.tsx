import {
  SuperintendentMobileNav,
  SuperintendentSidebar,
} from "@/components/superintendent/SuperintendentSidebar";
import { SuperintendentScopeBar } from "@/components/superintendent/SuperintendentScopeBar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";

export default function SuperintendentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
