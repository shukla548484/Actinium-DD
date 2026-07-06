import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import { EMDR_V32_RELEASE, EMDR_V33_RELEASE } from "@/lib/emdr/v3/sheets";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";

function uniqueBy<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Merge multiple parsed EMDR workbooks without duplicating master IDs. */
export function mergeParsedEmdrRepositories(
  primary: ParsedV3MasterRepository,
  ...supplements: ParsedV3MasterRepository[]
): ParsedV3MasterRepository {
  const all = [primary, ...supplements];

  const masterJobs = uniqueBy(
    all.flatMap((r) => r.masterJobs),
    (j) => j.jobId,
  );
  const templates = uniqueBy(
    all.flatMap((r) => r.templates),
    (t) => t.templateId,
  );
  const measurements = uniqueBy(
    all.flatMap((r) => r.measurements),
    (m) => m.measurementId,
  );
  const checklistItems = uniqueBy(
    all.flatMap((r) => r.checklistItems),
    (c) => c.checklistItemId,
  );
  const scopeSteps = uniqueBy(
    all.flatMap((r) => r.scopeSteps),
    (s) => s.scopeStepId,
  );
  const spares = uniqueBy(
    all.flatMap((r) => r.spares),
    (s) => s.spareMapId,
  );
  const rfqMappings = uniqueBy(
    all.flatMap((r) => r.rfqMappings),
    (r) => r.mappingId,
  );
  const workflows = uniqueBy(
    all.flatMap((r) => r.workflows),
    (w) => w.workflowId,
  );

  const equipmentMaster = uniqueBy(
    all.flatMap((r) => r.emdrMasterData.equipmentMaster),
    (e) => e.equipmentCode,
  );
  const componentMaster = uniqueBy(
    all.flatMap((r) => r.emdrMasterData.componentMaster),
    (c) => c.componentCode,
  );
  const tools = uniqueBy(
    all.flatMap((r) => r.emdrMasterData.tools),
    (t) => t.toolId,
  );

  const indexByCode = new Map<string, ParsedV3MasterRepository["repositoryIndex"][number]>();
  for (const repo of all) {
    for (const row of repo.repositoryIndex) {
      indexByCode.set(row.systemCode, row);
    }
  }

  const hasPmpSupplement = supplements.some((s) =>
    s.masterJobs.some((j) => j.jobId.startsWith("JOBS-PMP-")),
  );
  const hasBlrSupplement = supplements.some((s) =>
    s.masterJobs.some((j) => j.jobId.startsWith("JOBS-BLR-")),
  );
  const libraryVersion =
    supplements.length > 0 && hasPmpSupplement
      ? EMDR_V33_RELEASE
      : supplements.length > 0 && hasBlrSupplement
        ? EMDR_V32_RELEASE
        : supplements.length > 0
          ? supplements[supplements.length - 1]!.release
          : primary.release;

  const merged: ParsedMtilWorkbook = {
    libraryVersion,
    masterJobs,
    templates,
    measurements,
    checklistItems,
    scopeSteps,
    attachments: [],
    spares,
    rfqMappings,
    workflows,
  };

  return {
    ...merged,
    emdrMasterData: { equipmentMaster, componentMaster, tools },
    repositoryIndex: [...indexByCode.values()],
    release: libraryVersion,
  };
}
