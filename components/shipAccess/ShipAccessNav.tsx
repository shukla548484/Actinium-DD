"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildShipAccessNavGroups,
  SHIP_ACCESS_FULL_NAV_PAGE_KEYS,
  type ShipAccessNavGroup,
} from "@/lib/navigation/buildCrewNav";
import type { ShipAccessNavItem } from "@/lib/navigation/shipAccessNavItems";
import { cn } from "@/lib/utils";

function isLinkActive(pathname: string, href: string): boolean {
  const [path, query] = href.split("?");
  if (query) {
    return pathname === path;
  }
  if (href === "/ship-access") return pathname === "/ship-access";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: ShipAccessNavGroup): boolean {
  return group.items.some((item) => isLinkActive(pathname, item.href));
}

function GroupDropdown({
  group,
  pathname,
}: {
  group: ShipAccessNavGroup;
  pathname: string;
}) {
  const Icon = group.icon;
  const active = isGroupActive(pathname, group);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className={cn(
              "h-auto shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          />
        }
      >
        <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 truncate">{group.label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {group.items.map((item) => (
          <GroupMenuItem key={`${item.href}-${item.label}`} item={item} pathname={pathname} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GroupMenuItem({
  item,
  pathname,
}: {
  item: ShipAccessNavItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isLinkActive(pathname, item.href);

  return (
    <DropdownMenuItem
      render={<Link href={item.href} />}
      className={cn("gap-2 py-2", active && "bg-accent font-medium")}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">{item.label}</span>
    </DropdownMenuItem>
  );
}

function OverviewLink({ item, pathname }: { item: ShipAccessNavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

/** Grouped sub-navigation for Ship Access — filtered for crew page assignments. */
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

  const groups =
    assignedPageKeys == null
      ? buildShipAccessNavGroups([...SHIP_ACCESS_FULL_NAV_PAGE_KEYS])
      : buildShipAccessNavGroups(assignedPageKeys);

  if (groups.length === 0) return null;

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2"
      aria-label="Ship Access sections"
    >
      {groups.map((group) => {
        if (group.id === "overview" && group.items.length === 1) {
          return (
            <OverviewLink key={group.id} item={group.items[0]!} pathname={pathname} />
          );
        }
        return <GroupDropdown key={group.id} group={group} pathname={pathname} />;
      })}
    </nav>
  );
}
