import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import {
  getActiveInputSubmission,
  upsertInputSubmission,
  type InputSubmissionDto,
} from "@/lib/db/superintendent/inputs";
import {
  cloneSeaValveRows,
  mergeSeaValveRows,
  parseSeaValvesFromValues,
  sanitizeSeaValveValues,
  type SeaValveRow,
} from "@/lib/superintendent/seaValves";

export type PreviousSeaValvesResult = {
  valves: SeaValveRow[];
  project: {
    id: string;
    name: string;
    referenceCode: string | null;
    plannedStart: string | null;
  } | null;
};

export async function getPreviousSeaValvesForProject(
  dryDockProjectId: string,
): Promise<PreviousSeaValvesResult> {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { vesselId: true },
  });
  if (!project) return { valves: [], project: null };

  const submissions = await prisma.ddInputSubmission.findMany({
    where: {
      sectionKey: "sea_valves",
      ...notDeleted,
      inactiveAt: null,
      dryDockProjectId: { not: dryDockProjectId },
      dryDockProject: { vesselId: project.vesselId, ...notDeleted },
    },
    select: {
      valuesJson: true,
      updatedAt: true,
      dryDockProject: {
        select: {
          id: true,
          name: true,
          referenceCode: true,
          plannedStart: true,
          createdAt: true,
        },
      },
    },
  });

  submissions.sort((a, b) => {
    const aStart = a.dryDockProject.plannedStart?.getTime() ?? 0;
    const bStart = b.dryDockProject.plannedStart?.getTime() ?? 0;
    if (aStart !== bStart) return bStart - aStart;
    const aCreated = a.dryDockProject.createdAt.getTime();
    const bCreated = b.dryDockProject.createdAt.getTime();
    if (aCreated !== bCreated) return bCreated - aCreated;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  for (const row of submissions) {
    const values = (row.valuesJson as Record<string, unknown> | null) ?? {};
    const valves = parseSeaValvesFromValues(values);
    if (valves.length === 0) continue;
    return {
      valves: cloneSeaValveRows(valves),
      project: {
        id: row.dryDockProject.id,
        name: row.dryDockProject.name,
        referenceCode: row.dryDockProject.referenceCode,
        plannedStart: row.dryDockProject.plannedStart?.toISOString() ?? null,
      },
    };
  }

  return { valves: [], project: null };
}

export async function importSeaValvesForProject(input: {
  dryDockProjectId: string;
  incoming: SeaValveRow[];
  currentValves?: SeaValveRow[];
}): Promise<{
  submission: InputSubmissionDto;
  valves: SeaValveRow[];
  imported: number;
  skipped: number;
}> {
  const existing = await getActiveInputSubmission(input.dryDockProjectId, "sea_valves");
  if (existing?.status === "approved" || existing?.status === "inactive") {
    throw new Error("Sea valves input is locked and cannot be imported into.");
  }

  const base =
    input.currentValves && input.currentValves.length > 0
      ? input.currentValves
      : parseSeaValvesFromValues(existing?.valuesJson);
  const { merged, imported, skipped } = mergeSeaValveRows(base, input.incoming);
  const valuesJson = sanitizeSeaValveValues({
    ...(existing?.valuesJson ?? {}),
    valves: merged,
  });

  const submission = await upsertInputSubmission({
    dryDockProjectId: input.dryDockProjectId,
    sectionKey: "sea_valves",
    valuesJson,
    enteredByRole: existing?.enteredByRole ?? "vessel",
    enteredByName: existing?.enteredByName,
    status: existing?.status && existing.status !== "draft" ? existing.status : "draft",
  });

  return {
    submission,
    valves: parseSeaValvesFromValues(submission.valuesJson),
    imported,
    skipped,
  };
}
