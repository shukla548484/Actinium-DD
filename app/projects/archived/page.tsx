import Link from "next/link";
import { Archive } from "lucide-react";
import { ArchivedProjectsList } from "@/components/portal/ArchivedProjectsList";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/auth/session";
import { listArchivedProjectsForUser } from "@/lib/projects/archive";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArchivedProjectsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const projects = await listArchivedProjectsForUser(userId);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Archived projects"
        description="Projects and workspaces in your vessel scope that have been archived. Unarchive restores them for the archiver or an administrator."
        actions={
          <Button variant="outline" render={<Link href="/projects" />} nativeButton={false}>
            Active projects
          </Button>
        }
      />

      {projects.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Archive className="size-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No archived projects in your scope.</p>
          </CardContent>
        </Card>
      ) : (
        <ArchivedProjectsList projects={projects} />
      )}
    </PageShell>
  );
}
