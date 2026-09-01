import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { createDdJob, updateDdJob } from "@/lib/db/superintendent/jobs";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import {
  PAINTING_AREA_DEFS,
  PAINTING_HULL_ZONE_FIELDS,
  parsePaintingAreas,
  type PaintingAreaEntry,
  type PaintingAreaId,
} from "@/lib/superintendent/paintingCoating";

export const PAINTING_INPUT_JOB_TAG = "[paintingInput=1]";

export function paintingAreaJobTag(areaId: PaintingAreaId): string {
  return `[paintingArea=${areaId}]${PAINTING_INPUT_JOB_TAG}`;
}

export function parsePaintingAreaFromJobDescription(
  description: string | null | undefined,
): PaintingAreaId | null {
  if (!description?.includes(PAINTING_INPUT_JOB_TAG)) return null;
  const match = description.match(/\[paintingArea=([a-z_]+)\]/);
  if (!match) return null;
  const id = match[1] as PaintingAreaId;
  return PAINTING_AREA_DEFS.some((d) => d.id === id) ? id : null;
}

export function isPaintingInputJob(description: string | null | undefined): boolean {
  return Boolean(description?.includes(PAINTING_INPUT_JOB_TAG));
}

const PAINTING_SCOPE_BOILERPLATE =
  /^Edit structured scope|^.*painting scope for this docking \(vessel input\)/i;

/** Short preview for scope-of-work table — skips tags and boilerplate. */
export function formatPaintingInputScopePreview(
  description: string | null | undefined,
): string {
  if (!description?.includes(PAINTING_INPUT_JOB_TAG)) return "";
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("["));
  const useful = lines.filter((line) => !PAINTING_SCOPE_BOILERPLATE.test(line));
  return useful.slice(0, 2).join(" · ");
}

type AreaJobConfig = {
  title: string;
  category: string;
  workshop: string;
  /** Template job title to merge into (hull uses seeded "Painting Scope"). */
  templateTitle?: string;
};

export const PAINTING_AREA_JOB_CONFIG: Record<PaintingAreaId, AreaJobConfig> = {
  hull: {
    title: "Hull Paint",
    category: "painting",
    workshop: "Painting",
    templateTitle: "Painting Scope",
  },
  ballast_tanks: {
    title: "Ballast Tank Paint",
    category: "painting",
    workshop: "Painting",
  },
  cargo_holds: {
    title: "Cargo Hold Paint",
    category: "painting",
    workshop: "Painting",
  },
  cargo_tanks: {
    title: "Cargo Tanks Paint",
    category: "painting",
    workshop: "Painting",
  },
  sea_chest: {
    title: "Sea Chest Paint",
    category: "painting",
    workshop: "Painting",
  },
  chain_locker: {
    title: "Chain Locker Paint",
    category: "painting",
    workshop: "Painting",
  },
  main_deck: {
    title: "Main Deck Paint",
    category: "painting",
    workshop: "Painting",
  },
};

function parseOptionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtM2(n: number | null): string {
  return n == null ? "—" : `${n.toLocaleString()} m²`;
}

function buildHullZoneLines(values: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const zone of PAINTING_HULL_ZONE_FIELDS) {
    const n = parseOptionalNumber(values[zone.key]);
    if (n != null) lines.push(`${zone.label}: ${fmtM2(n)}`);
  }
  return lines;
}

function buildSchemeLines(values: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const scheme =
    typeof values.currentPaintScheme === "string" ? values.currentPaintScheme.trim() : "";
  const antifouling =
    typeof values.antifoulingType === "string" ? values.antifoulingType.trim() : "";
  const dft =
    typeof values.dftRequirement === "string" ? values.dftRequirement.trim() : "";
  if (scheme) lines.push(`Current scheme: ${scheme}`);
  if (antifouling) lines.push(`Antifouling: ${antifouling}`);
  if (dft) lines.push(`DFT requirement: ${dft} µm`);
  const notes = typeof values.areaNotes === "string" ? values.areaNotes.trim() : "";
  if (notes) lines.push(`Notes: ${notes}`);
  return lines;
}

export function buildPaintingAreaJobDescription(
  areaId: PaintingAreaId,
  values: Record<string, unknown>,
  entry: PaintingAreaEntry,
): string {
  const def = PAINTING_AREA_DEFS.find((d) => d.id === areaId)!;
  const lines: string[] = [
    `${def.label} painting scope for this docking (vessel input).`,
    "Edit structured scope in Painting & coating — changes sync here automatically.",
  ];

  if (areaId === "hull") {
    const zones = buildHullZoneLines(values);
    if (zones.length) lines.push(`Hull zones: ${zones.join("; ")}`);
  } else if (entry.areaM2 != null) {
    lines.push(`Area: ${fmtM2(entry.areaM2)}`);
  }

  lines.push(`Yard painting: ${entry.percentYard ?? 0}%`);
  lines.push(
    `Coats — primer: ${entry.primerCoats ?? 0}, finish: ${entry.finishCoats ?? 0}`,
  );
  if (entry.paintSystem) lines.push(`Paint system: ${entry.paintSystem}`);

  if (areaId === "hull") {
    const schemeLines = buildSchemeLines(values);
    lines.push(...schemeLines);
  }

  lines.push(paintingAreaJobTag(areaId));
  return lines.join("\n");
}

export function parsePaintingJobIds(
  valuesJson: Record<string, unknown>,
): Partial<Record<PaintingAreaId, string>> {
  const raw = valuesJson.paintingJobIds;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<PaintingAreaId, string>> = {};
  for (const def of PAINTING_AREA_DEFS) {
    const id = (raw as Record<string, unknown>)[def.id];
    if (typeof id === "string" && id.trim()) out[def.id] = id.trim();
  }
  return out;
}

async function findExistingPaintingAreaJob(
  dryDockProjectId: string,
  areaId: PaintingAreaId,
  storedId: string | null,
  config: AreaJobConfig,
) {
  if (storedId) {
    const byId = await prisma.ddJob.findFirst({
      where: { id: storedId, dryDockProjectId, ...notDeleted },
      select: { id: true, title: true, description: true },
    });
    if (byId) return byId;
  }

  const tag = paintingAreaJobTag(areaId);
  const byTag = await prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      description: { contains: tag },
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true },
  });
  if (byTag) return byTag;

  if (config.templateTitle) {
    const byTemplate = await prisma.ddJob.findFirst({
      where: {
        dryDockProjectId,
        title: config.templateTitle,
        category: config.category,
        ...notDeleted,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, description: true },
    });
    if (byTemplate) return byTemplate;
  }

  const byTitle = await prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      title: config.title,
      category: config.category,
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true },
  });
  return byTitle;
}

/**
 * Sync each included painting area to a project scope job (DdJob).
 * Idempotent — reuses template "Painting Scope" for hull when present.
 * Does not delete jobs when an area is unchecked (may already be quoted).
 */
export async function persistPaintingScopeJobs(
  dryDockProjectId: string,
  valuesJson: Record<string, unknown>,
): Promise<Partial<Record<PaintingAreaId, string>>> {
  const areas = parsePaintingAreas(valuesJson);
  const existingIds = parsePaintingJobIds(valuesJson);
  const nextIds: Partial<Record<PaintingAreaId, string>> = { ...existingIds };
  let progressDirty = false;

  for (const def of PAINTING_AREA_DEFS) {
    const entry = areas[def.id];
    if (!entry.included) continue;

    const config = PAINTING_AREA_JOB_CONFIG[def.id];
    const description = buildPaintingAreaJobDescription(def.id, valuesJson, entry);
    const storedId = existingIds[def.id] ?? null;
    let job = await findExistingPaintingAreaJob(
      dryDockProjectId,
      def.id,
      storedId,
      config,
    );

    if (!job) {
      const created = await createDdJob({
        dryDockProjectId,
        title: config.title,
        category: config.category,
        workshop: config.workshop,
        description,
        status: "planned",
        priority: "medium",
      });
      job = { id: created.id, title: created.title, description: created.description };
      progressDirty = true;
    } else if (job.description !== description || job.title !== config.title) {
      const updated = await updateDdJob(job.id, {
        title: config.title,
        description,
        category: config.category,
        workshop: config.workshop,
      });
      job = { id: updated.id, title: updated.title, description: updated.description };
    }

    nextIds[def.id] = job.id;
  }

  if (progressDirty) {
    await syncDryDockProjectProgress(dryDockProjectId);
  }

  return nextIds;
}
