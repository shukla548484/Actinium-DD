"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnarchiveProjectButton } from "@/components/portal/UnarchiveProjectButton";
import { fmtDate } from "@/lib/superintendent/formatters";
import type { ArchivedProjectRow } from "@/lib/projects/archive";

type Props = {
  projects: ArchivedProjectRow[];
};

export function ArchivedProjectsList({ projects: initial }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {projects.map((p) => (
        <Card key={`${p.kind}-${p.id}`} className="shadow-none">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">
                <Link href={p.href} className="hover:underline">
                  {p.name}
                </Link>
              </CardTitle>
              <CardDescription>
                {[p.vesselLabel, p.referenceCode].filter(Boolean).join(" · ") || "—"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {p.kind === "tender" ? "Tender" : "Dry dock"}
              </Badge>
              <Badge variant="outline">{p.status.replace(/_/g, " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-0 text-xs text-muted-foreground">
            <span>Archived {fmtDate(p.archivedAt)}</span>
            <div className="flex flex-wrap gap-2">
              {p.canUnarchive ? (
                <UnarchiveProjectButton
                  kind={p.kind}
                  projectId={p.id}
                  redirectTo={p.kind === "tender" ? `/projects/${p.id}` : p.href}
                  onDone={() => {
                    setProjects((prev) =>
                      prev.filter((row) => !(row.kind === p.kind && row.id === p.id)),
                    );
                    router.refresh();
                  }}
                />
              ) : null}
              <Button
                size="sm"
                variant="outline"
                render={<Link href={p.href} />}
                nativeButton={false}
              >
                Open
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
