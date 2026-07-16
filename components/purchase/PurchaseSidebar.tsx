"use client";

import { usePathname } from "next/navigation";
import { NavItemLink } from "@/components/layout/NavItemLink";
import {
  canSeePurchaseNavItem,
  purchaseNavGroups,
  purchaseNavItems,
  resolvePurchaseNavId,
} from "@/lib/navigation/purchaseNavItems";

type Props = {
  /** From session — designation access level (PMS-compatible). SYS_ADMIN sees all. */
  accessLevel?: number | null;
  isSysAdmin?: boolean;
};

export function PurchaseSidebar({ accessLevel = 50, isSysAdmin = true }: Props) {
  const pathname = usePathname();
  const active = resolvePurchaseNavId(pathname);
  const visible = purchaseNavItems.filter((item) =>
    canSeePurchaseNavItem(item, accessLevel, isSysAdmin),
  );

  return (
    <aside
      className="dd-module-sidebar hidden w-60 shrink-0 border-r bg-muted/30 md:block"
      aria-label="Purchase module navigation"
    >
      <div className="dd-module-sidebar-scroll flex flex-col gap-1 px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Purchase
        </p>
        {purchaseNavGroups.map((group) => {
          const items = visible.filter((i) => i.group === group);
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

export function PurchaseMobileNav({ accessLevel = 50, isSysAdmin = true }: Props) {
  const pathname = usePathname();
  const active = resolvePurchaseNavId(pathname);
  const visible = purchaseNavItems.filter((item) =>
    canSeePurchaseNavItem(item, accessLevel, isSysAdmin),
  );

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2 md:hidden"
      aria-label="Purchase sections"
    >
      {visible.map((item) => (
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
