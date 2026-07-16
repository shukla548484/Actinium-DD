import {
  PurchaseMobileNav,
  PurchaseSidebar,
} from "@/components/purchase/PurchaseSidebar";
import { ModuleScrollArea } from "@/components/layout/ModuleScrollArea";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export default async function PurchaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/purchase";
  await enforceOfficePageAccess(pathname);

  return (
    <div className="dd-module-layout">
      <div className="shrink-0">
        <PurchaseMobileNav isSysAdmin />
      </div>
      <div className="dd-module-row">
        <PurchaseSidebar isSysAdmin />
        <ModuleScrollArea>{children}</ModuleScrollArea>
      </div>
    </div>
  );
}
