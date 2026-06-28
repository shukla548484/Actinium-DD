"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  resolveSuperintendentNavId,
  superintendentNavGroups,
  superintendentNavItems,
} from "@/lib/navigation/superintendentNavItems";
import { cn } from "@/lib/utils";

export function SuperintendentSidebar() {
  const pathname = usePathname();
  const active = resolveSuperintendentNavId(pathname);

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
          const items = superintendentNavItems.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              <p className="mb-1 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      title={item.description}
                      className={cn(
                        "flex items-center rounded-md px-2 py-2 text-sm transition-colors",
                        active === item.id
                          ? "bg-background font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
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

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Superintendent sections"
    >
      {superintendentNavItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
            active === item.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
