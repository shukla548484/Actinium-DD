import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Reports & export"
        description="Summary reports and Excel exports for dry dock execution."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tender comparison</CardTitle>
            <CardDescription>
              Compare yard quotes side-by-side for tender projects.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/projects" />}
              nativeButton={false}
            >
              Open projects to compare →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget summary</CardTitle>
            <CardDescription>Budget vs quoted vs actual by category.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/superintendent/budget" />}
              nativeButton={false}
            >
              Open budget lines →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily reports</CardTitle>
            <CardDescription>Yard daily progress and manpower logs.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/superintendent/monitoring/daily-reports" />}
              nativeButton={false}
            >
              Open daily reports →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress tracker</CardTitle>
            <CardDescription>Project completion trends across the fleet.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/superintendent/monitoring/progress" />}
              nativeButton={false}
            >
              Open progress tracker →
            </Button>
          </CardHeader>
        </Card>
      </div>
    </PageShell>
  );
}
