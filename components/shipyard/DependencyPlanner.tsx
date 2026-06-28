import { DEPENDENCY_CHAIN_TEMPLATE } from "@/lib/shipyard/workshops";
import type { WorkshopJobRecord } from "@/lib/shipyard/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DependencyPlanner({ jobs }: { jobs: WorkshopJobRecord[] }) {
  const jobByCode = new Map(jobs.filter((j) => j.jobCode).map((j) => [j.jobCode!, j]));
  const edges = jobs.flatMap((job) =>
    job.predecessorIds.map((predId) => {
      const pred = jobs.find((j) => j.id === predId);
      return pred ? { from: pred, to: job } : null;
    }),
  ).filter(Boolean) as { from: WorkshopJobRecord; to: WorkshopJobRecord }[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Job dependencies</CardTitle>
          <CardDescription>
            Blocking links between workshop jobs — delays propagate along this chain to undocking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No dependencies mapped yet. Initialize jobs from owner scope to seed the standard chain.
            </p>
          ) : (
            <ol className="space-y-2">
              {edges.map(({ from, to }) => (
                <li
                  key={`${from.id}-${to.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{from.jobCode ?? from.id.slice(0, 6)}</span>
                  <span className="text-muted-foreground">{from.jobTitle}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-xs">{to.jobCode ?? to.id.slice(0, 6)}</span>
                  <span>{to.jobTitle}</span>
                  {to.isCriticalPath ? <Badge variant="outline">Critical path</Badge> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference chain</CardTitle>
          <CardDescription>Typical dry-dock workshop sequence (docking → hull → valves → paint → undocking)</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 border-l-2 pl-4">
            {DEPENDENCY_CHAIN_TEMPLATE.map((step, i) => {
              const mapped = [...jobByCode.values()].find(
                (j) => j.workshopSlug === step.workshopSlug && j.jobTitle.toLowerCase().includes(step.jobTitle.split(" ")[0]!.toLowerCase()),
              );
              return (
                <li key={step.jobTitle} className="relative pb-2 text-sm">
                  <span className="absolute -left-[1.15rem] top-1 size-2 rounded-full bg-primary" />
                  <span className="font-medium">{i + 1}. {step.jobTitle}</span>
                  <span className="ml-2 text-muted-foreground">({step.workshopSlug})</span>
                  {mapped ? (
                    <Badge className="ml-2" variant="secondary">
                      mapped: {mapped.jobCode}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
