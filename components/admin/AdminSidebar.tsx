"use client";

import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import {
  adminNavGroups,
  adminNavItems,
  resolveAdminNavId,
} from "@/lib/navigation/adminNavItems";

/** Vertical admin sub-menu — visible only inside the Admin module. */
export function AdminSidebar() {
  const pathname = usePathname();
  const active = resolveAdminNavId(pathname);

  return (
    <aside
      className="dd-module-sidebar hidden w-56 shrink-0 border-r bg-muted/30 md:block"
      aria-label="Admin navigation"
    >
      <div className="dd-module-sidebar-scroll flex flex-col gap-1 px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Administration
        </p>

        {adminNavGroups.map((group) => {
          const items = adminNavItems.filter((item) => item.group === group);
          if (items.length === 0) return null;

          return (
            <div key={group} className="mb-3">
              <p className="mb-1 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <NavItemLink
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      title={item.description}
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

/** Compact horizontal admin tabs for mobile — replaces sidebar on small screens. */
export function AdminMobileNav() {
  const pathname = usePathname();
  const active = resolveAdminNavId(pathname);

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Admin sections"
    >
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <NavItemLink
            key={item.id}
            href={item.href}
            label={item.label}
            icon={Icon}
            active={isActive}
            size="xs"
            className="shrink-0 rounded-full px-3 py-1.5"
          />
        );
      })}
    </nav>
  );
}
