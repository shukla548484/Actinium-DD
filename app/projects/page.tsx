import Link from "next/link";
import { ProjectsWorkbench } from "@/components/portal/ProjectsWorkbench";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getProjectsWorkbench } from "@/lib/projects/workbench";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const workbench = await getProjectsWorkbench();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Dry dock projects"
        description="Active docking work for your vessels, plus recently completed reviews and open tenders."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href="/superintendent/projects" />}
              nativeButton={false}
            >
              All workspaces
            </Button>
            <Button render={<Link href="/projects/new" />} nativeButton={false}>
              New project
            </Button>
          </div>
        }
      />
      <ProjectsWorkbench data={workbench} />
    </PageShell>
  );
}
