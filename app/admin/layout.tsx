import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminSidebar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  await enforceOfficePageAccess(pathname);

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
