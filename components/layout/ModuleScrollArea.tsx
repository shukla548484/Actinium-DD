import { AppFooter } from "@/components/layout/AppFooter";

/** Scrollable main column for sidebar module layouts (superintendent, admin, shipyard). */
export function ModuleScrollArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="dd-main min-w-0 flex-1">
      <div className="dd-main-scroll">
        {children}
        <AppFooter />
      </div>
    </div>
  );
}

export function isSidebarModulePath(pathname: string): boolean {
  return (
    pathname.startsWith("/superintendent") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/shipyard") ||
    pathname.startsWith("/ship-access")
  );
}
