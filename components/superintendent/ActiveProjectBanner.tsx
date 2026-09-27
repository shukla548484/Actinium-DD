"use client";

import Link from "next/link";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";
import { Button } from "@/components/ui/button";

/**
 * Banner on global superintendent list pages when an active project is set.
 * Links to the project workspace and the projects list to change selection.
 */
export function ActiveProjectBanner() {
  const { activeProject, setActiveProjectId } = useActiveDryDockProject();
  if (!activeProject) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <p>
        <span className="text-muted-foreground">Active project:</span>{" "}
        <Link
          href={`/superintendent/projects/${activeProject.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {activeProject.name}
        </Link>
        <span className="text-muted-foreground">
          {" "}
          · {activeProject.vessel.name} ({activeProject.vessel.code})
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/superintendent/projects" />}
          nativeButton={false}
        >
          Change project
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void setActiveProjectId(null)}
        >
          Clear (fleet-wide)
        </Button>
      </div>
    </div>
  );
}
