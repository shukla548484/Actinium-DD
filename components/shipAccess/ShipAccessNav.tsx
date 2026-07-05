"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import { buildShipAccessNavItems } from "@/lib/navigation/buildCrewNav";

function isLinkActive(pathname: string, href: string): boolean {
  const [path, query] = href.split("?");
  if (query) {
    return pathname === path;
  }
  if (href === "/ship-access") return pathname === "/ship-access";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal sub-navigation for the Ship Access module — filtered for crew page assignments. */
export function ShipAccessNav() {
  const pathname = usePathname();
  const [assignedPageKeys, setAssignedPageKeys] = useState<string[] | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { isVesselCrew?: boolean; assignedPageKeys?: string[] }
          | undefined;
        if (user?.isVesselCrew) {
          setAssignedPageKeys(user.assignedPageKeys ?? []);
        } else {
          setAssignedPageKeys(null);
        }
      })
      .catch(() => setAssignedPageKeys(null));
  }, [pathname]);

  const navItems =
    assignedPageKeys == null
      ? buildShipAccessNavItems([
          "page.shipAccess.dashboard",
          "page.shipAccess.machineryDashboard",
          "page.shipAccess.machineryRunningHours",
          "page.shipAccess.dryDockDashboard",
          "page.shipAccess.dryDockJobs.new",
          "page.shipAccess.dryDockJobs",
          "page.shipAccess.defects.new",
          "page.shipAccess.defects",
          "page.shipAccess.purchase",
        ])
      : buildShipAccessNavItems(assignedPageKeys);

  if (navItems.length === 0) return null;

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2"
      aria-label="Ship Access sections"
    >
      {navItems.map((item) => (
        <NavItemLink
          key={`${item.href}-${item.label}`}
          href={item.href}
          label={item.label}
          icon={item.icon}
          title={item.description}
          active={isLinkActive(pathname, item.href)}
          size="xs"
          className="shrink-0 rounded-full px-3 py-1.5"
        />
      ))}
    </nav>
  );
}
