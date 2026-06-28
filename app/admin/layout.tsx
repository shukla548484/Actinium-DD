import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminSidebar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <AdminMobileNav />
      </div>
      <div className="dd-module-row">
        <AdminSidebar />
        <ModuleScrollArea>{children}</ModuleScrollArea>
      </div>
    </div>
  );
}
