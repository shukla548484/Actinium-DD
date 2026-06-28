"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  adminNavGroups,
  adminNavItems,
  resolveAdminNavId,
} from "@/lib/navigation/adminNavItems";
import { cn } from "@/lib/utils";

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
                {items.map((item) => {
                  const isActive = active === item.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        title={item.description}
                        className={cn(
                          "flex items-center rounded-md px-2 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-background font-medium text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
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
        const isActive = active === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
