import { buildEmdrMasterRepositoryTree } from "@/lib/emdr/v3/buildJobLibraryTree";
import { loadEmdrMasterRepositoryParsed } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import {
  getEmdrMasterRepositoryReleaseConfig,
  type EmdrMasterRepositoryReleaseConfig,
} from "@/lib/emdr/v3/sheets";
import {
  isEmdrMasterRepositoryPresent,
  resolveEmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";

function releaseConfig(): EmdrMasterRepositoryReleaseConfig | null {
  const kind = resolveEmdrMasterRepositoryKind();
  return kind ? getEmdrMasterRepositoryReleaseConfig(kind) : null;
}

export function generateEmdrMasterRepositoryTree(): JobLibrarySeedNode | null {
  const config = releaseConfig();
  const parsed = loadEmdrMasterRepositoryParsed();
  if (!config || !parsed || parsed.masterJobs.length === 0) return null;
  return buildEmdrMasterRepositoryTree(parsed, config);
}

/** @deprecated Use generateEmdrMasterRepositoryTree. */
export function generateV30JobLibraryTree(): JobLibrarySeedNode | null {
  return generateEmdrMasterRepositoryTree();
}

export function getEmdrMasterRepositoryWorkbookStats() {
  const config = releaseConfig();
  if (!config || !isEmdrMasterRepositoryPresent()) {
    return {
      kind: null as "v33" | "v32" | "v31" | "v30" | null,
      release: null as string | null,
      systemCount: 0,
      mainEngineSystemCount: 0,
      auxiliaryEngineSystemCount: 0,
      boilerSystemCount: 0,
      pumpSystemCount: 0,
      jobCount: 0,
      mainEngineJobCount: 0,
      auxiliaryEngineJobCount: 0,
      boilerJobCount: 0,
      pumpJobCount: 0,
      catalogTemplateCount: 0,
      measurementCount: 0,
      checklistItemCount: 0,
      workbookPresent: false,
      mergedBundle: false,
    };
  }

  const parsed = loadEmdrMasterRepositoryParsed();
  if (!parsed) {
    return {
      kind: config.kind,
      release: config.release,
      systemCount: 0,
      mainEngineSystemCount: 0,
      auxiliaryEngineSystemCount: 0,
      boilerSystemCount: 0,
      pumpSystemCount: 0,
      jobCount: 0,
      mainEngineJobCount: 0,
      auxiliaryEngineJobCount: 0,
      boilerJobCount: 0,
      pumpJobCount: 0,
      catalogTemplateCount: 0,
      measurementCount: 0,
      checklistItemCount: 0,
      workbookPresent: false,
      mergedBundle: false,
    };
  }

  const meSystems = parsed.repositoryIndex.filter((s) => s.machineryFamily === "Main Engine");
  const aeSystems = parsed.repositoryIndex.filter((s) => s.machineryFamily === "Auxiliary Engine");
  const blrSystems = parsed.repositoryIndex.filter((s) => s.machineryFamily === "Boilers");
  const pmpSystems = parsed.repositoryIndex.filter((s) => s.machineryFamily === "Pumps");
  const meJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-")).length;
  const aeJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-AE-")).length;
  const blrJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-BLR-")).length;
  const pmpJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PMP-")).length;

  return {
    kind: config.kind,
    release: parsed.release || config.release,
    systemCount: parsed.repositoryIndex.length,
    mainEngineSystemCount: meSystems.length,
    auxiliaryEngineSystemCount: aeSystems.length,
    boilerSystemCount: blrSystems.length,
    pumpSystemCount: pmpSystems.length,
    jobCount: parsed.masterJobs.length,
    mainEngineJobCount: meJobs,
    auxiliaryEngineJobCount: aeJobs,
    boilerJobCount: blrJobs,
    pumpJobCount: pmpJobs,
    catalogTemplateCount: parsed.templates.length,
    measurementCount: parsed.measurements.length,
    checklistItemCount: parsed.checklistItems.length,
    workbookPresent: true,
    mergedBundle: meJobs > 0 && aeJobs > 0 && (blrJobs > 0 || pmpJobs > 0),
  };
}

/** @deprecated Use getEmdrMasterRepositoryWorkbookStats. */
export function getV30CombinedWorkbookStats() {
  const stats = getEmdrMasterRepositoryWorkbookStats();
  return {
    release: stats.release ?? "V3.0-ME-100",
    systemCount: stats.systemCount,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
    measurementCount: stats.measurementCount,
    checklistItemCount: stats.checklistItemCount,
    workbookPresent: stats.workbookPresent,
  };
}
