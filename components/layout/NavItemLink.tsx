"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItemLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  title?: string;
  size?: "sm" | "xs";
  className?: string;
  onClick?: () => void;
};

/** Sidebar / module sub-menu link with a leading icon. */
export function NavItemLink({
  href,
  label,
  icon: Icon,
  active,
  title,
  size = "sm",
  className,
  onClick,
}: NavItemLinkProps) {
  const iconClass = size === "xs" ? "size-3.5" : "size-4";

  return (
    <Link
      href={href}
      title={title}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors",
        size === "xs" ? "px-2 py-1.5 text-xs" : "px-2 py-2 text-sm",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        className,
      )}
    >
      <Icon className={cn(iconClass, "shrink-0 opacity-80")} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

type TopNavSubmenuLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Parent owns routing — this node unmounts when the dropdown closes. */
  onNavigate: (href: string) => void;
  className?: string;
};

/** Top bar dropdown item — single-line label; parent handles routing. */
export function TopNavSubmenuLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  className,
}: TopNavSubmenuLinkProps) {
  return (
    <a
      href={href}
      role="menuitem"
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent/50 font-medium",
        className,
      )}
      onClick={(e) => {
        // Allow cmd/ctrl-click to open in a new tab via native <a> behavior.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        onNavigate(href);
      }}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  );
}
