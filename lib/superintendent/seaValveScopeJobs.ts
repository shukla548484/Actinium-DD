import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { createDdJob, updateDdJob } from "@/lib/db/superintendent/jobs";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import {
  SEA_VALVE_GROUPS,
  countSeaValveOverhaul,
  parseSeaValveRows,
  seaValveRowHasContent,
} from "@/lib/superintendent/seaValves";

export const SEA_VALVE_INPUT_JOB_TAG = "[seaValveInput=1]";

export const SEA_VALVE_JOB_CONFIG = {
  title: "Sea Valve Survey",
  category: "piping",
  workshop: "Valve",
} as const;

export function isSeaValveInputJob(job: {
  category?: string | null;
  title?: string | null;
  workshop?: string | null;
  description?: string | null;
}): boolean {
  if (job.description?.includes(SEA_VALVE_INPUT_JOB_TAG)) return true;
  if (
    job.title === SEA_VALVE_JOB_CONFIG.title &&
    job.category === SEA_VALVE_JOB_CONFIG.category
  ) {
    return true;
  }
  if (/sea\s*valve/i.test(job.title ?? "") && job.workshop?.toLowerCase() === "valve") {
    return true;
  }
  return false;
}

export function buildSeaValveJobDescription(values: Record<string, unknown>): string {
  const valves = parseSeaValveRows(values.valves).filter(seaValveRowHasContent);
  const counts = countSeaValveOverhaul(valves);
  const lines: string[] = [
    "Sea valve survey scope for this docking (vessel input).",
    "Edit valves in Sea valves — changes sync here automatically.",
    `Total valves: ${counts.total} (In situ: ${counts.inSitu}, Workshop: ${counts.workshop})`,
  ];

  for (const group of SEA_VALVE_GROUPS) {
    const n = valves.filter((row) => row.group === group.key).length;
    if (n > 0) lines.push(`${group.label}: ${n}`);
  }

  const notes = typeof values.notes === "string" ? values.notes.trim() : "";
  if (notes) lines.push(`Notes: ${notes}`);

  lines.push(SEA_VALVE_INPUT_JOB_TAG);
  return lines.join("\n");
}

/** Short preview for scope-of-work table — skips tags and boilerplate. */
export function formatSeaValveInputScopePreview(
  description: string | null | undefined,
): string {
  if (!description?.includes(SEA_VALVE_INPUT_JOB_TAG)) return "";
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("["));
  const useful = lines.filter(
    (line) =>
      !/^Sea valve survey scope for this docking/i.test(line) &&
      !/^Edit valves in Sea valves/i.test(line),
  );
  return useful.slice(0, 2).join(" · ");
}

export function parseSeaValveJobId(valuesJson: Record<string, unknown>): string | null {
  const id = valuesJson.seaValveJobId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function findExistingSeaValveJob(
  dryDockProjectId: string,
  storedId: string | null,
  linkedJobId: string | null,
) {
  if (storedId) {
    const byId = await prisma.ddJob.findFirst({
      where: { id: storedId, dryDockProjectId, ...notDeleted },
      select: { id: true, title: true, description: true },
    });
    if (byId) return byId;
  }

  if (linkedJobId) {
    const byLinked = await prisma.ddJob.findFirst({
      where: { id: linkedJobId, dryDockProjectId, ...notDeleted },
      select: { id: true, title: true, description: true },
    });
    if (byLinked) return byLinked;
  }

  const byTag = await prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      description: { contains: SEA_VALVE_INPUT_JOB_TAG },
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true },
  });
  if (byTag) return byTag;

  return prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      title: SEA_VALVE_JOB_CONFIG.title,
      category: SEA_VALVE_JOB_CONFIG.category,
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true },
  });
}

/**
 * Sync sea valve input to the Sea Valve Survey scope job. Idempotent — reuses template job when present.
 */
export async function persistSeaValveScopeJob(
  dryDockProjectId: string,
  valuesJson: Record<string, unknown>,
  linkedJobId: string | null = null,
): Promise<string | null> {
  const description = buildSeaValveJobDescription(valuesJson);
  const storedId = parseSeaValveJobId(valuesJson);
  let job = await findExistingSeaValveJob(dryDockProjectId, storedId, linkedJobId);
  let progressDirty = false;

  if (!job) {
    const created = await createDdJob({
      dryDockProjectId,
      title: SEA_VALVE_JOB_CONFIG.title,
      category: SEA_VALVE_JOB_CONFIG.category,
      workshop: SEA_VALVE_JOB_CONFIG.workshop,
      description,
      status: "planned",
      priority: "medium",
    });
    job = { id: created.id, title: created.title, description: created.description };
    progressDirty = true;
  } else if (job.description !== description) {
    const updated = await updateDdJob(job.id, {
      description,
      category: SEA_VALVE_JOB_CONFIG.category,
      workshop: SEA_VALVE_JOB_CONFIG.workshop,
    });
    job = { id: updated.id, title: updated.title, description: updated.description };
  }

  if (progressDirty) {
    await syncDryDockProjectProgress(dryDockProjectId);
  }

  return job.id;
}
