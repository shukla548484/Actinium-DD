import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { YardRegisterPanel } from "@/components/shipyard/YardRegisterPanel";
import { listProjects } from "@/lib/db/index";
import { getYardWorkProjectByProjectId, listYardWorkProjects } from "@/lib/db/yardExecution";
import { REGISTER_CONFIG } from "@/lib/shipyard/registerConfig";
import type { YardRegisterType } from "@/lib/shipyard/registerTypes";
import { workshopBySlug } from "@/lib/shipyard/workshops";

export async function loadShipyardRegisterPageData(projectParam?: string) {
  const [yardProjects, fleetProjects] = await Promise.all([
    listYardWorkProjects(),
    listProjects(),
  ]);

  const eligible = fleetProjects.filter((p) => p.status !== "draft");
  const projectId = projectParam ?? yardProjects[0]?.projectId ?? eligible[0]?.id ?? null;

  const projects = eligible.map((p) => {
    const ywp = yardProjects.find((y) => y.projectId === p.id);
    return {
      projectId: p.id,
      projectName: p.name,
      yardWorkProjectId: ywp?.id ?? "",
    };
  });

  const jobs =
    projectId != null
      ? (await getYardWorkProjectByProjectId(projectId)).jobs.map((j) => ({
          id: j.id,
          jobCode: j.jobCode,
          jobTitle: j.jobTitle,
          workshopName: j.workshopName ?? workshopBySlug(j.workshopSlug)?.name ?? j.workshopSlug,
        }))
      : [];

  return { projectId, projects, jobs };
}

export async function ShipyardRegisterPage({
  registerType,
  searchParams,
}: {
  registerType: YardRegisterType;
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const { projectId, projects, jobs } = await loadShipyardRegisterPageData(project);
  const config = REGISTER_CONFIG[registerType];

  return (
    <PageShell size="wide">
      <PageHeader title={config.title} description={config.description} />
      <YardRegisterPanel
        registerType={registerType}
        projectId={projectId}
        projects={projects}
        jobs={jobs}
      />
    </PageShell>
  );
}
