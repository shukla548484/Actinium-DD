"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ClipboardList, KeyRound, LogOut, Menu, Search, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavBrandMark } from "@/components/layout/NavBrandMark";
import { TopNavSubmenuLink } from "@/components/layout/NavItemLink";
import { cn } from "@/lib/utils";
import {
  getTopNavSections,
  isTopNavItemActive,
  priorityNavItems,
  tasksNavItem,
  type TopNavId,
  type TopNavItem,
} from "@/lib/navigation/topNavItems";

const MENU_CLOSE_DELAY_MS = 400;

export interface TopNavBarProps {
  companyName?: string;
  userName?: string;
  userRole?: string;
  pendingTasksCount?: number;
  syncOnline?: boolean;
  syncLabel?: string;
  mode?: "portal" | "desktop";
  activeNav?: TopNavId;
  onNavigate?: (id: TopNavId) => void;
  navItems?: TopNavItem[];
  homeHref?: string;
  showTasksPending?: boolean;
  showSearch?: boolean;
}

function ModuleDropdown({
  item,
  pathname,
  isOpen,
  onOpen,
  onClose,
  onScheduleClose,
  onCancelClose,
}: {
  item: TopNavItem;
  pathname: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onScheduleClose: () => void;
  onCancelClose: () => void;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const Icon = item.icon;
  const isActive = isTopNavItemActive(pathname, item);
  const sections = getTopNavSections(item);
  const hasMenu = sections.some((s) => s.items.length > 0);

  const btnClass = cn(
    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    (isActive || isOpen) && "bg-sidebar-accent text-sidebar-accent-foreground",
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelPos({ top: rect.bottom, left: rect.left });
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      onClose();
      // Hard navigation from the portaled menu is the reliable path — soft
      // router.push from a closing portal was getting cancelled.
      window.location.assign(href);
    },
    [onClose],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen, onClose]);

  if (!hasMenu) {
    return (
      <Link href={item.href ?? "/projects"} className={btnClass}>
        <Icon className="size-5 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </Link>
    );
  }

  const panel = isOpen && mounted ? (
    <div
      ref={panelRef}
      role="menu"
      className="fixed z-[9999]"
      style={{ top: panelPos.top, left: panelPos.left }}
      onMouseEnter={onCancelClose}
      onMouseLeave={onScheduleClose}
    >
      <div className="dropdown-scroll min-w-[15rem] w-64 max-h-[min(600px,calc(100dvh-var(--dd-nav-height,3rem)))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover py-1.5 text-popover-foreground shadow-lg">
        {sections.flatMap((group) =>
          group.items.map((sub) => {
            const subActive =
              pathname === sub.href || pathname.startsWith(`${sub.href}/`);
            return (
              <TopNavSubmenuLink
                key={`${sub.href}-${sub.label}`}
                href={sub.href}
                label={sub.label}
                icon={sub.icon}
                active={subActive}
                onNavigate={navigateTo}
              />
            );
          }),
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="relative shrink-0"
        onMouseEnter={() => {
          onCancelClose();
          updatePosition();
          onOpen();
        }}
        onMouseLeave={onScheduleClose}
      >
        <button
          type="button"
          className={btnClass}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => {
            onCancelClose();
            updatePosition();
            if (isOpen) onClose();
            else onOpen();
          }}
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          <span>{item.label}</span>
        </button>
      </div>
      {panel && createPortal(panel, document.body)}
    </>
  );
}

function TasksPendingLink({
  pathname,
  pendingTasksCount,
}: {
  pathname: string;
  pendingTasksCount: number;
}) {
  const isActive =
    pathname === tasksNavItem.href || pathname.startsWith(`${tasksNavItem.href}/`);

  return (
    <Link
      href={tasksNavItem.href}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
      title={tasksNavItem.description}
    >
      <ClipboardList className="size-5 shrink-0" aria-hidden />
      <span>{tasksNavItem.label}</span>
      {pendingTasksCount > 0 ? (
        <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
        </span>
      ) : null}
    </Link>
  );
}

export function TopNavBar({
  companyName = "Actinium-DD",
  userName = "Office User",
  userRole = "Actinium-DD portal",
  pendingTasksCount = 0,
  syncOnline,
  syncLabel,
  mode = "portal",
  activeNav: _activeNav,
  onNavigate,
  navItems = priorityNavItems,
  homeHref = "/projects",
  showTasksPending = true,
  showSearch = true,
}: TopNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), MENU_CLOSE_DELAY_MS);
  }, [cancelClose]);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  useEffect(() => () => cancelClose(), [cancelClose]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`${homeHref}?search=${encodeURIComponent(q)}`);
    else router.push(homeHref);
  }

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const renderModule = (item: TopNavItem) => {
    if (mode === "desktop" && onNavigate && !item.sections?.length && !item.children?.length) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <item.icon className="size-5" aria-hidden />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <ModuleDropdown
        key={item.id}
        item={item}
        pathname={pathname}
        isOpen={openMenu === item.id}
        onOpen={() => setOpenMenu(item.id)}
        onClose={closeMenu}
        onScheduleClose={scheduleClose}
        onCancelClose={cancelClose}
      />
    );
  };

  return (
    <nav
      className="sticky top-0 z-50 w-full shrink-0 overflow-visible border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"
      style={{ backgroundColor: "var(--sidebar)", color: "var(--sidebar-foreground)" }}
      aria-label="Main navigation"
    >
      <div className="flex h-12 items-center gap-2 overflow-visible px-3 md:px-4 lg:px-6">
        <div className="mr-1 shrink-0 md:mr-2">
          <NavBrandMark homeHref={homeHref} company={{ name: companyName }} />
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-visible md:flex">
          {navItems.map(renderModule)}
          {showTasksPending ? (
            <TasksPendingLink pathname={pathname} pendingTasksCount={pendingTasksCount} />
          ) : null}
        </div>

        <div className="flex flex-1 items-center md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-80 gap-0 border-border bg-popover p-0">
              <SheetHeader className="border-b border-border pb-3 pt-10 pr-12">
                <SheetTitle className="text-lg">Modules</SheetTitle>
              </SheetHeader>
              <div className="dropdown-scroll space-y-4 overflow-y-auto px-4 py-3">
                {navItems.map((item) => (
                  <div key={item.id}>
                    <p className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <item.icon className="size-4" />
                      {item.label}
                    </p>
                    <div className="space-y-0.5 pl-2">
                      {getTopNavSections(item).flatMap((g) =>
                        g.items.map((sub) => (
                          <TopNavSubmenuLink
                            key={sub.href + sub.label}
                            href={sub.href}
                            label={sub.label}
                            icon={sub.icon}
                            active={
                              pathname === sub.href || pathname.startsWith(`${sub.href}/`)
                            }
                            onNavigate={(href) => {
                              setMobileOpen(false);
                              window.location.assign(href);
                            }}
                            className="rounded-md hover:bg-accent"
                          />
                        )),
                      )}
                      {!getTopNavSections(item).length && item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                        >
                          Open {item.label}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
                {showTasksPending ? (
                  <div>
                    <Link
                      href={tasksNavItem.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-accent"
                    >
                      <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {tasksNavItem.label}
                      {pendingTasksCount > 0 ? (
                        <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
                        </span>
                      ) : null}
                    </Link>
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {showSearch ? (
          <form onSubmit={handleSearch} className="relative hidden w-52 shrink-0 lg:block xl:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages, modules, features…"
              className="h-8 border-sidebar-border bg-sidebar-accent/50 pl-8 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50"
            />
          </form>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1 pl-1 sm:gap-2">
          {syncLabel !== undefined ? (
            <div
              className="mr-1 hidden items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-1.5 text-xs lg:inline-flex"
              title={syncLabel}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  syncOnline ? "bg-emerald-500" : "bg-destructive",
                )}
              />
              {syncOnline ? "Synced" : "Offline"}
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="icon-sm"
            className="relative text-sidebar-foreground hover:bg-sidebar-accent"
            title="Notifications"
            render={<Link href={homeHref} />}
            nativeButton={false}
          >
            <Bell className="size-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 max-w-[10rem] gap-2 rounded-full pr-2 pl-1 text-sidebar-foreground hover:bg-sidebar-accent"
                />
              }
            >
              <Avatar size="sm" className="size-8 shrink-0">
                <AvatarFallback className="bg-[#e11d48] text-[0.65rem] font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden truncate text-xs font-medium sm:inline">{userName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
              {mode === "portal" ? (
                <>
                  <DropdownMenuItem render={<Link href="/account" />}>
                    <User className="size-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/account/password" />}>
                    <KeyRound className="size-4" />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void signOut()}>
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled>Local fleet user</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
