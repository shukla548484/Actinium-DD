"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { NavItemLink } from "@/components/layout/NavItemLink";
import {
  PROJECT_INPUT_LINK_ICONS,
  PROJECT_MODULE_ICONS,
} from "@/lib/navigation/projectModuleIcons";
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
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/vessel-portal`,
      label: "Vessel portal",
      icon: PROJECT_INPUT_LINK_ICONS.vesselPortal,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/vessel`,
      label: "Vessel",
      icon: PROJECT_INPUT_LINK_ICONS.vessel,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/superintendent`,
      label: "Superintendent",
      icon: PROJECT_INPUT_LINK_ICONS.superintendent,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/workshop`,
      label: "Workshop",
      icon: PROJECT_INPUT_LINK_ICONS.workshop,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/procurement`,
      label: "Procurement",
      icon: PROJECT_INPUT_LINK_ICONS.procurement,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/closeout`,
      label: "Closeout inputs",
      icon: PROJECT_INPUT_LINK_ICONS.closeout,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/review`,
      label: "Input review",
      icon: PROJECT_INPUT_LINK_ICONS.review,
    },
    {
      href: `/superintendent/projects/${dryDockProjectId}/inputs/readiness`,
      label: "Readiness",
      icon: PROJECT_INPUT_LINK_ICONS.readiness,
    },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-2 py-2"
      aria-label="Project workspace modules"
    >
      <NavItemLink
        href={dashboardHref}
        label="Dashboard"
        icon={LayoutDashboard}
        active={isDashboard}
        size="xs"
        className="shrink-0 rounded-full px-3 py-1.5"
      />
      {primary.map((mod) => {
        const hrefPath = mod.href.split("?")[0] ?? "";
        const active =
          pathname === hrefPath ||
          (hrefPath.startsWith(`/superintendent/projects/${dryDockProjectId}/`) &&
            pathname === hrefPath);
        const Icon = PROJECT_MODULE_ICONS[mod.id as keyof typeof PROJECT_MODULE_ICONS] ?? LayoutDashboard;
        return (
          <NavItemLink
            key={mod.id}
            href={mod.href}
            label={`${mod.label}${mod.count != null ? ` (${mod.count})` : ""}`}
            icon={Icon}
            active={active}
            size="xs"
            className="shrink-0 rounded-full px-3 py-1.5"
          />
        );
      })}
      {inputLinks.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <NavItemLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            active={active}
            size="xs"
            className="shrink-0 rounded-full px-3 py-1.5"
          />
        );
      })}
    </nav>
  );
}
