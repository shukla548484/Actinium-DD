import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import {
  formatDryDockProjectCode,
  previewDryDockProjectCode,
} from "@/lib/superintendent/projectCodes";

/** Prefer dry-dock code sequence; also reserve against tender project reference codes. */
export async function nextTenderProjectCode(vesselId: string): Promise<string> {
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: { code: true },
  });
  if (!vessel) throw new Error("Vessel not found");

  const [ddCount, tenderCount] = await Promise.all([
    prisma.dryDockProject.count({ where: { vesselId } }),
    prisma.project.count({ where: { vesselId, ...notDeleted } }),
  ]);

  let seq = Math.max(ddCount, tenderCount) + 1;
  let code = formatDryDockProjectCode(vessel.code, seq);

  while (
    (await prisma.dryDockProject.findFirst({
      where: { referenceCode: code, ...notDeleted },
      select: { id: true },
    })) ||
    (await prisma.project.findFirst({
      where: { referenceCode: code, ...notDeleted },
      select: { id: true },
    }))
  ) {
    seq += 1;
    code = formatDryDockProjectCode(vessel.code, seq);
  }

  return code;
}

export async function previewTenderProjectCode(vesselId: string): Promise<string | null> {
  try {
    return await nextTenderProjectCode(vesselId);
  } catch {
    return previewDryDockProjectCode(vesselId);
  }
}

export type VesselCreateContextDto = {
  id: string;
  code: string;
  name: string;
  imoNumber: string | null;
  vesselType: string | null;
  flag: string | null;
  classSociety: string | null;
  yearBuilt: number | null;
  lastIntermediateSurveyDate: string | null;
  dockingSurveyDate: string | null;
  nextDryDockDue: string | null;
  company: { id: string; name: string; code: string } | null;
};

function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Vessel summary for the new-tender form details card. */
export async function getVesselCreateContext(
  vesselId: string,
): Promise<VesselCreateContextDto | null> {
  // Avoid selecting lastIntermediateSurveyDate here so a stale Prisma client
  // (dev server not yet reloaded after migrate) still serves the details card.
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: {
      id: true,
      code: true,
      name: true,
      imoNumber: true,
      vesselType: true,
      flag: true,
      classSociety: true,
      yearBuilt: true,
      lastDryDockDate: true,
      nextDryDockDue: true,
      company: { select: { id: true, name: true, code: true } },
    },
  });
  if (!vessel) return null;

  const [lastIntermediateProject, lastDocking, intermediateRow] = await Promise.all([
    prisma.dryDockProject.findFirst({
      where: {
        vesselId,
        ...notDeleted,
        projectType: "intermediate_survey",
      },
      orderBy: [{ actualEnd: "desc" }, { plannedEnd: "desc" }, { updatedAt: "desc" }],
      select: { actualEnd: true, plannedEnd: true },
    }),
    prisma.dryDockProject.findFirst({
      where: {
        vesselId,
        ...notDeleted,
        projectType: { in: ["special_survey", "emergency_docking", "underwater_survey"] },
      },
      orderBy: [{ actualEnd: "desc" }, { plannedEnd: "desc" }, { updatedAt: "desc" }],
      select: { actualEnd: true, plannedEnd: true },
    }),
    prisma.$queryRaw<Array<{ last_intermediate_survey_date: Date | null }>>`
      SELECT last_intermediate_survey_date
      FROM vessels
      WHERE id = ${vesselId}
        AND deleted_at IS NULL
      LIMIT 1
    `.catch(() => [] as Array<{ last_intermediate_survey_date: Date | null }>),
  ]);

  const intermediateFromProject =
    isoDate(lastIntermediateProject?.actualEnd) ?? isoDate(lastIntermediateProject?.plannedEnd);
  const dockingFromProject =
    isoDate(lastDocking?.actualEnd) ?? isoDate(lastDocking?.plannedEnd);
  const storedIntermediate = isoDate(intermediateRow[0]?.last_intermediate_survey_date ?? null);

  return {
    id: vessel.id,
    code: vessel.code,
    name: vessel.name,
    imoNumber: vessel.imoNumber,
    vesselType: vessel.vesselType,
    flag: vessel.flag,
    classSociety: vessel.classSociety,
    yearBuilt: vessel.yearBuilt,
    lastIntermediateSurveyDate: storedIntermediate ?? intermediateFromProject,
    dockingSurveyDate: isoDate(vessel.lastDryDockDate) ?? dockingFromProject,
    nextDryDockDue: isoDate(vessel.nextDryDockDue),
    company: vessel.company,
  };
}
