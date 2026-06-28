import Link from "next/link";
import { ProjectList } from "@/components/portal/ProjectList";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Tender projects"
        description="Manage dry-dock specs, invite shipyards, and compare hybrid quotes."
        actions={
          <Button render={<Link href="/projects/new" />} nativeButton={false}>
            New project
          </Button>
        }
      />
      <ProjectList projects={projects} />
    </PageShell>
  );
}
