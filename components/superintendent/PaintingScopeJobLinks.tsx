"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  PAINTING_AREA_DEFS,
  parsePaintingAreas,
  type PaintingAreaId,
} from "@/lib/superintendent/paintingCoating";
import { parsePaintingJobIds } from "@/lib/superintendent/paintingScopeJobs";

type Props = {
  values: Record<string, unknown>;
  dryDockProjectId: string;
};

export function PaintingScopeJobLinks({ values, dryDockProjectId }: Props) {
  const jobIds = parsePaintingJobIds(values);
  const areas = parsePaintingAreas(values);
  const linked = PAINTING_AREA_DEFS.filter(
    (def) => areas[def.id].included && jobIds[def.id],
  );

  if (linked.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      <p className="font-medium">Linked scope jobs</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Included areas appear on Scope of work. Edit here or on the scope page — both stay in sync
        when you save.
      </p>
      <ul className="mt-2 space-y-1">
        {linked.map((def) => (
          <li key={def.id}>
            <Link
              href={`/superintendent/jobs/${jobIds[def.id as PaintingAreaId]}/edit`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {def.label}
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        <Link
          href={`/superintendent/projects/${dryDockProjectId}/scope`}
          className="text-primary hover:underline"
        >
          Open full scope of work
        </Link>
      </p>
    </div>
  );
}

export function PaintingInputJobBanner({
  dryDockProjectId,
  areaLabel,
}: {
  dryDockProjectId: string;
  areaLabel?: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="font-medium">Shared with Painting &amp; coating input</p>
      <p className="mt-0.5 text-muted-foreground">
        {areaLabel
          ? `${areaLabel} scope is defined in the vessel Painting & coating section.`
          : "Structured painting scope is defined in the vessel Painting & coating section."}{" "}
        Edit zones, % yard, and coats there — this job description updates automatically on save.
        Title, priority, and status can be edited here.
      </p>
      <Link
        href={`/superintendent/projects/${dryDockProjectId}/inputs/vessel/condition`}
        className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
      >
        Open Painting &amp; coating
        <ExternalLink className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
