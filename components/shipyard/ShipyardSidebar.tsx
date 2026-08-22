"use client";

import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import {
  shipyardModuleSections,
  shipyardSectionForPath,
} from "@/lib/navigation/shipyardNavItems";
import {
  shipyardNavDualLabel,
  useShipyardLangPrefs,
} from "@/lib/i18n/shipyardNavLabels";
import { cn } from "@/lib/utils";

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/shipyard") return pathname === "/shipyard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShipyardSidebar() {
  const pathname = usePathname();
  const prefs = useShipyardLangPrefs();
  const section = shipyardSectionForPath(pathname);

  return (
    <aside
      className="dd-module-sidebar hidden w-60 shrink-0 border-r bg-muted/30 md:block"
      aria-label="Shipyard module navigation"
    >
      <div className="dd-module-sidebar-scroll flex flex-col gap-4 px-3 py-4">
        <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {shipyardNavDualLabel(prefs, {
            uiKey: "navSyWorkflow",
            fallback: "Shipyard workflow",
          })}
        </div>

        {shipyardModuleSections.map((mod) => {
          const sectionActive = mod.id === section.id;
          const SectionIcon = mod.icon;
          return (
            <div key={mod.id}>
              <NavItemLink
                href={mod.href}
                label={shipyardNavDualLabel(prefs, {
                  moduleId: mod.id,
                  href: mod.href,
                  fallback: mod.label,
                })}
                icon={SectionIcon}
                active={sectionActive}
                className={cn(
                  "mb-1 items-start font-medium",
                  !sectionActive && "shadow-none",
                )}
              />
              {mod.items.length > 0 ? (
                <ul className="ml-1 space-y-0.5 border-l pl-2">
                  {mod.items.map((item) => (
                    <li key={item.href}>
                      <NavItemLink
                        href={item.href}
                        label={shipyardNavDualLabel(prefs, {
                          href: item.href,
                          fallback: item.label,
                        })}
                        icon={item.icon}
                        active={isLinkActive(pathname, item.href)}
                        size="xs"
                        className={cn(
                          "items-start",
                          isLinkActive(pathname, item.href) &&
                            "font-medium text-foreground shadow-none",
                        )}
                      />
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
  const prefs = useShipyardLangPrefs();
  const section = shipyardSectionForPath(pathname);

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Shipyard sections"
    >
      {shipyardModuleSections.map((mod) => (
        <NavItemLink
          key={mod.id}
          href={mod.href}
          label={shipyardNavDualLabel(prefs, {
            moduleId: mod.id,
            href: mod.href,
            fallback: mod.label,
          })}
          icon={mod.icon}
          active={mod.id === section.id}
          size="xs"
          className="shrink-0 items-start rounded-md px-3 py-1.5"
        />
      ))}
    </nav>
  );
}
