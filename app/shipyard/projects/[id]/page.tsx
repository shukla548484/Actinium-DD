import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { DependencyEditor } from "@/components/shipyard/DependencyEditor";
import { InitExecutionButton } from "@/components/shipyard/InitExecutionButton";
import { ShipyardKpiGrid } from "@/components/shipyard/ShipyardKpiGrid";
import { WorkshopJobBoard } from "@/components/shipyard/WorkshopJobBoard";
import { Button } from "@/components/ui/button";
import { getProject } from "@/lib/db/index";
import {
  computeShipyardKpis,
  getYardWorkProjectByProjectId,
} from "@/lib/db/yardExecution";

export const dynamic = "force-dynamic";

export default async function ShipyardProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const { yardWorkProject, jobs } = await getYardWorkProjectByProjectId(id);
  const kpis = computeShipyardKpis(jobs);

  return (
    <PageShell size="wide">
      <PageHeader
        title={project.name}
        description={`${project.vesselName ?? "Vessel TBC"} · Yard execution · ${yardWorkProject.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {jobs.length === 0 ? <InitExecutionButton projectId={id} /> : null}
            <Button
              variant="outline"
              render={<Link href={`/shipyard/planning/dependencies?project=${id}`} />}
              nativeButton={false}
            >
              Dependencies
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/projects/${id}`} />}
              nativeButton={false}
            >
              Superintendent view
            </Button>
          </div>
        }
      />

      <ShipyardKpiGrid kpis={kpis} />
      <WorkshopJobBoard jobs={jobs} />
      {jobs.length > 0 ? <DependencyEditor projectId={id} jobs={jobs} /> : null}
    </PageShell>
  );
}
