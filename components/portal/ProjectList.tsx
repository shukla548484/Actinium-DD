"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableCard } from "@/components/layout/TableCard";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/tender/types";
import { statusTheme } from "@/lib/theme";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  tendering: "Tendering",
  comparing: "Comparing",
  closed: "Closed",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: statusTheme.draft.bg,
  tendering: statusTheme.tendering.bg,
  comparing: statusTheme.comparing.bg,
  closed: statusTheme.closed.bg,
};

export function ProjectList({
  projects,
  newProjectHref = "/projects/new",
  getProjectHref = (id: string) => `/projects/${id}`,
}: {
  projects: Project[];
  newProjectHref?: string;
  getProjectHref?: (id: string) => string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  const filtered = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.vesselName?.toLowerCase().includes(q) ||
          p.referenceCode?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [projects, search, statusFilter]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const p of projects) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    }
    return byStatus;
  }, [projects]);

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <p className="text-muted-foreground">No tender projects yet.</p>
          <Button className="mt-4" render={<Link href={newProjectHref} />}>
            Create your first project
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total projects" value={projects.length} variant="black" />
        <StatCard label="Draft" value={stats["draft"] ?? 0} variant="neutral" />
        <StatCard label="Tendering" value={stats["tendering"] ?? 0} variant="orange" />
        <StatCard label="Comparing" value={stats["comparing"] ?? 0} variant="rose" />
        <StatCard label="Closed" value={stats["closed"] ?? 0} variant="yellow" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, vessel, or reference code…"
          className="min-w-[200px] flex-1"
        />
        <div className="flex flex-wrap gap-1">
          <FilterBtn
            label="All"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
            <FilterBtn
              key={s}
              label={STATUS_LABEL[s]}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              count={stats[s] ?? 0}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No projects match your search.
          </CardContent>
        </Card>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={getProjectHref(p.id)}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    {p.referenceCode && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.referenceCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.vesselName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.currency}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[p.status]}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="xs"
                      render={<Link href={getProjectHref(p.id)} />}
                    >
                      Open →
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Showing {filtered.length} of {projects.length} project
        {projects.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: number;
  variant?: "neutral" | "orange" | "rose" | "yellow" | "black";
}) {
  return (
    <Card
      className={cn(
        variant === "orange" && "border-orange-200 bg-orange-50/60 dark:bg-orange-950/20",
        variant === "rose" && "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20",
        variant === "yellow" && "border-yellow-200 bg-yellow-50/60 dark:bg-yellow-950/20",
        variant === "black" && "border-foreground/10 bg-muted/40",
        variant === "neutral" && "bg-muted/30",
      )}
    >
      <CardHeader className="py-4">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function FilterBtn({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="xs"
      onClick={onClick}
      className="rounded-full"
    >
      {label}
      {count != null && count > 0 && (
        <span className={active ? "text-primary-foreground/70" : "text-muted-foreground"}>
          {count}
        </span>
      )}
    </Button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
