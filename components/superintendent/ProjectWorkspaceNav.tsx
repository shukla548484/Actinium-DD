"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleCard } from "@/lib/superintendent/engine/workspaceSummary";

type Props = {
  dryDockProjectId: string;
};

export function ProjectWorkspaceNav({ dryDockProjectId }: Props) {
  const pathname = usePathname();
  const [modules, setModules] = useState<WorkspaceModuleCard[]>([]);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${dryDockProjectId}/workspace`)
      .then((r) => r.json())
      .then((d: { workspace?: { modules: WorkspaceModuleCard[] } }) => {
        setModules(d.workspace?.modules ?? []);
      });
  }, [dryDockProjectId]);

  const dashboardHref = `/superintendent/projects/${dryDockProjectId}`;
  const isDashboard = pathname === dashboardHref;

  const primary = modules.filter((m) =>
    [
      "scope",
      "jobs",
      "budget",
      "timeline",
      "workshops",
      "survey",
      "permits",
      "procurement",
      "inspections",
      "approvals",
      "daily_progress",
      "rfq",
      "documents",
      "shipyard",
      "sea_trial",
      "resources",
      "closeout",
      "reports",
    ].includes(m.id),
  );

  const inputLinks = [
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/vessel-portal`, label: "Vessel portal" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/vessel`, label: "Vessel inputs" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/superintendent`, label: "Superintendent" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/workshop`, label: "Workshop" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/procurement`, label: "Procurement" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/closeout`, label: "Closeout inputs" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/review`, label: "Input review" },
    { href: `/superintendent/projects/${dryDockProjectId}/inputs/readiness`, label: "Readiness" },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-2 py-2"
      aria-label="Project workspace modules"
    >
      <Link
        href={dashboardHref}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          isDashboard
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
      >
        Dashboard
      </Link>
      {primary.map((mod) => {
        const hrefPath = mod.href.split("?")[0] ?? "";
        const active =
          pathname === hrefPath ||
          (hrefPath.startsWith(`/superintendent/projects/${dryDockProjectId}/`) &&
            pathname === hrefPath);
        return (
          <Link
            key={mod.id}
            href={mod.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {mod.label}
            {mod.count != null ? ` (${mod.count})` : ""}
          </Link>
        );
      })}
      {inputLinks.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
