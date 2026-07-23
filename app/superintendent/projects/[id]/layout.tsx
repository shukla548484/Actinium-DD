"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/layout/BackButton";
import { ProjectWorkspaceNav } from "@/components/superintendent/ProjectWorkspaceNav";
import { formatProjectTypeLabel } from "@/lib/superintendent/engine/projectTypes";
import { getStatusLabel } from "@/lib/superintendent/engine/statusWorkflow";
import type { DryDockProjectStatus, DryDockProjectType } from "@prisma/client";

type ProjectHeader = {
  id: string;
  name: string;
  referenceCode: string | null;
  projectType: DryDockProjectType;
  status: DryDockProjectStatus;
  vessel: { name: string; code: string };
};

export default function ProjectWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectHeader | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d.project as ProjectHeader | undefined;
        if (p) setProject(p);
      });
  }, [id]);

  return (
    <div className="flex flex-col">
      {project ? (
        <div className="border-b bg-card px-4 py-3 md:px-6">
          <div className="dd-content-width flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-0.5">
              <p className="font-mono text-xs text-muted-foreground">
                {project.referenceCode ?? project.id}
              </p>
              <h2 className="text-lg font-semibold leading-tight">{project.name}</h2>
              <p className="text-sm text-muted-foreground">
                {project.vessel.name} ({project.vessel.code}) ·{" "}
                {formatProjectTypeLabel(project.projectType)} · {getStatusLabel(project.status)}
              </p>
            </div>
            <BackButton fallbackHref="/superintendent/projects" label="All projects" />
          </div>
        </div>
      ) : null}
      <ProjectWorkspaceNav dryDockProjectId={id} />
      {children}
    </div>
  );
}
