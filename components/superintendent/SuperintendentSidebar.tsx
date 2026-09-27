"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";
import {
  buildSuperintendentNavItems,
  resolveSuperintendentNavId,
  superintendentNavGroups,
} from "@/lib/navigation/superintendentNavItems";

export function SuperintendentSidebar() {
  const pathname = usePathname();
  const active = resolveSuperintendentNavId(pathname);
  const { activeProjectId } = useActiveDryDockProject();
  const items = useMemo(
    () => buildSuperintendentNavItems(activeProjectId),
    [activeProjectId],
  );

  return (
    <aside
      className="dd-module-sidebar hidden w-56 shrink-0 border-r bg-muted/30 md:block"
      aria-label="Technical Superintendent navigation"
    >
      <div className="dd-module-sidebar-scroll flex flex-col gap-1 px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tech Superintendent
        </p>
        {superintendentNavGroups.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              <p className="mb-1 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map((item) => (
                  <li key={item.id}>
                    <NavItemLink
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={active === item.id}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function SuperintendentMobileNav() {
  const pathname = usePathname();
  const active = resolveSuperintendentNavId(pathname);
  const { activeProjectId } = useActiveDryDockProject();
  const items = useMemo(
    () => buildSuperintendentNavItems(activeProjectId),
    [activeProjectId],
  );

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Superintendent sections"
    >
      {items.map((item) => (
        <NavItemLink
          key={item.id}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={active === item.id}
          size="xs"
          className="shrink-0 rounded-full px-3 py-1.5"
        />
      ))}
    </nav>
  );
}
