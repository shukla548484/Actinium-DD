"use client";

import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import {
  VESSEL_WORKSPACE_NAV,
  vesselWorkspaceHref,
  type VesselWorkspaceSegment,
} from "@/lib/superintendent/vesselWorkspaceNav";

type Props = {
  dryDockProjectId: string;
  portal?: boolean;
};

function activeSegment(pathname: string, dryDockProjectId: string, portal: boolean): VesselWorkspaceSegment {
  const base = portal
    ? `/superintendent/projects/${dryDockProjectId}/inputs/vessel-portal`
    : `/superintendent/projects/${dryDockProjectId}/inputs/vessel`;

  if (pathname === base || pathname === `${base}/`) return "overview";

  for (const item of VESSEL_WORKSPACE_NAV) {
    if (item.segment === "overview") continue;
    const href = `${base}/${item.segment}`;
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return item.segment;
    }
  }

  return "overview";
}

export function VesselWorkspaceNav({ dryDockProjectId, portal }: Props) {
  const pathname = usePathname();
  const current = activeSegment(pathname, dryDockProjectId, Boolean(portal));

  return (
    <nav
      className="mb-4 flex gap-1 overflow-x-auto border-b pb-2"
      aria-label="Vessel workspace sections"
    >
      {VESSEL_WORKSPACE_NAV.map((item) => {
        const href = vesselWorkspaceHref(dryDockProjectId, item.segment, portal);
        return (
          <NavItemLink
            key={item.segment}
            href={href}
            label={item.label}
            icon={item.icon}
            active={current === item.segment}
            size="xs"
            className="shrink-0 rounded-full px-3 py-1.5"
          />
        );
      })}
    </nav>
  );
}
