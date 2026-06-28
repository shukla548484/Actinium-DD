"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  shipyardModuleSections,
  shipyardSectionForPath,
} from "@/lib/navigation/shipyardNavItems";
import { cn } from "@/lib/utils";

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/shipyard") return pathname === "/shipyard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShipyardSidebar() {
  const pathname = usePathname();
  const section = shipyardSectionForPath(pathname);

  return (
    <aside
      className="dd-module-sidebar hidden w-60 shrink-0 border-r bg-muted/30 md:block"
      aria-label="Shipyard module navigation"
    >
      <div className="dd-module-sidebar-scroll flex flex-col gap-4 px-3 py-4">
        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Shipyard execution
        </p>

        {shipyardModuleSections.map((mod) => {
          const sectionActive = mod.id === section.id;
          return (
            <div key={mod.id}>
              <Link
                href={mod.href}
                className={cn(
                  "mb-1 block rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  sectionActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {mod.label}
              </Link>
              {mod.items.length > 0 ? (
                <ul className="ml-1 space-y-0.5 border-l pl-2">
                  {mod.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "block rounded-md px-2 py-1.5 text-xs transition-colors",
                          isLinkActive(pathname, item.href)
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function ShipyardMobileNav() {
  const pathname = usePathname();
  const section = shipyardSectionForPath(pathname);

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Shipyard sections"
    >
      {shipyardModuleSections.map((mod) => (
        <Link
          key={mod.id}
          href={mod.href}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
            mod.id === section.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {mod.label}
        </Link>
      ))}
    </nav>
  );
}
