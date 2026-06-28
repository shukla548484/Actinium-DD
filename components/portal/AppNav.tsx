"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  href?: string;
  label: string;
  children?: { href: string; label: string; description?: string }[];
}

const navigation: NavItem[] = [
  {
    label: "Projects",
    children: [
      { href: "/projects", label: "All Projects", description: "View & manage all tender projects" },
      { href: "/projects/new", label: "New Project", description: "Create a new dry-dock tender" },
    ],
  },
];

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DesktopDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={isActive ? "default" : "ghost"}
            className={isActive ? "bg-dd-black text-white hover:bg-dd-black-soft" : ""}
          />
        }
      >
        {item.label}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {item.children!.map((child) => {
          const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
          return (
            <DropdownMenuItem
              key={child.href}
              render={<Link href={child.href} />}
              className="flex flex-col items-start gap-0.5 py-2.5"
            >
              <span className={`text-sm font-medium ${active ? "text-foreground" : ""}`}>
                {child.label}
              </span>
              {child.description && (
                <span className="text-xs text-muted-foreground">{child.description}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPortal = pathname.startsWith("/quote/");

  if (isPortal) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-dd-border bg-dd-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/projects" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dd-rose text-xs font-bold text-white">
            DD
          </div>
          <span className="hidden text-base font-bold tracking-tight text-dd-black sm:inline">
            Actinium-DD
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navigation.map((item) =>
            item.children ? (
              <DesktopDropdown key={item.label} item={item} pathname={pathname} />
            ) : (
              <Button
                key={item.href}
                variant={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "default"
                    : "ghost"
                }
                render={<Link href={item.href!} />}
              >
                {item.label}
              </Button>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            className="bg-dd-black hover:bg-dd-black-soft"
            render={<Link href="/projects/new" />}
          >
            + New Tender
          </Button>
          <SignOutButton />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle menu" />
            }
          >
            {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              {navigation.map((item) => (
                <div key={item.label} className="mb-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  {item.children?.map((child) => {
                    const active =
                      pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <Button
                        key={child.href}
                        variant={active ? "secondary" : "ghost"}
                        className="mb-1 w-full justify-start"
                        render={<Link href={child.href} onClick={() => setMobileOpen(false)} />}
                      >
                        {child.label}
                        {child.description && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {child.description}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              ))}
              <Button
                className="mt-2 w-full bg-dd-black hover:bg-dd-black-soft"
                render={<Link href="/projects/new" onClick={() => setMobileOpen(false)} />}
              >
                + New Tender
              </Button>
              <div className="mt-3">
                <SignOutButton className="w-full" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function SignOutButton({ className = "" }: { className?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <Button type="button" variant="outline" onClick={() => void logout()} className={className}>
      Sign out
    </Button>
  );
}
