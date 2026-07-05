import path from "node:path";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import {
  parseMasterRepositoryFileIfExists,
  type MasterRepositoryArea,
  type ParsedMasterRepository,
} from "./parseMasterRepository";

export const MASTER_REPOSITORY_V12_FILENAME =
  "Actinium_SM_MTIL_R0_9_Master_Engineering_Repository_v1.2.xlsx";

export const MASTER_REPOSITORY_V12_PATH = path.join(
  process.cwd(),
  "data/mtil",
  MASTER_REPOSITORY_V12_FILENAME,
);

export const MASTER_REPOSITORY_V12_VERSION = "MTIL-v1.2";
export const MASTER_REPOSITORY_RELEASE = "R0.9";

let cachedRepository: ParsedMasterRepository | null = null;

export function loadMasterRepositoryV12(): ParsedMasterRepository {
  if (!cachedRepository) {
    cachedRepository = parseMasterRepositoryFileIfExists(MASTER_REPOSITORY_V12_PATH);
  }
  return cachedRepository;
}

export function getMasterRepositoryV12Stats(data: ParsedMasterRepository = loadMasterRepositoryV12()) {
  return {
    phase: 10 as const,
    source: "master_repository_v1.2" as const,
    release: data.release ?? MASTER_REPOSITORY_RELEASE,
    libraryVersion: data.libraryVersion ?? MASTER_REPOSITORY_V12_VERSION,
    jobCount: 0,
    catalogTemplateCount: 0,
    dynamicTemplateCount: 0,
    systemCount: data.frameworkAreaCount,
    componentCount: 0,
    measurementCount: 0,
    checklistItemCount: 0,
    scopeStepCount: 0,
    spareMappingCount: 0,
    rfqMappingCount: 0,
    idPrefix: "MST-ENG",
    frameworkAreaCount: data.frameworkAreaCount,
    engineeringDomainCount: data.engineeringDomainCount,
    frameworkOnly: data.frameworkOnly,
    initializedOnly: data.initializedOnly,
    objective: data.objective,
    targetJobs: data.targetJobs,
    targetTemplates: data.targetTemplates,
    status: data.status,
  };
}

function areaCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "area";
}

function buildFrameworkCategory(
  code: string,
  name: string,
  areas: MasterRepositoryArea[],
): JobLibrarySeedNode {
  return {
    code,
    name,
    nodeType: "category",
    department: "Master Engineering Repository",
    description: `${areas.length} framework areas`,
    children: areas.map((area) => ({
      code: areaCode(area.area),
      name: area.area,
      nodeType: "system",
      description: area.status,
      mtilMeta: {
        frameworkStatus: area.status,
        frameworkSheet: area.sheet,
        masterRepository: true,
      },
      children: [],
    })),
  };
}

export function generateMasterRepositoryJobLibraryTree(
  data: ParsedMasterRepository = loadMasterRepositoryV12(),
): JobLibrarySeedNode {
  const stats = getMasterRepositoryV12Stats(data);

  return {
    code: "mtil_master_repo_v12",
    name: "Master Engineering Repository — R0.9 v1.2",
    nodeType: "department",
    department: "Master Engineering Repository",
    description:
      `${stats.libraryVersion} (${stats.release}) — ${stats.status ?? "framework completed"}. Target: ${stats.targetJobs ?? "4000–5000 jobs"}.`,
    mtilPhase: 10,
    mtilMeta: {
      release: stats.release,
      libraryVersion: stats.libraryVersion,
      frameworkOnly: stats.frameworkOnly,
      objective: stats.objective,
      targetJobs: stats.targetJobs,
      targetTemplates: stats.targetTemplates,
      frameworkAreaCount: stats.frameworkAreaCount,
    },
    children: [
      buildFrameworkCategory("master_repo_framework", "Master Repository", data.areas.repository),
      buildFrameworkCategory("project_templates_framework", "Project Templates", data.areas.projectTemplates),
      buildFrameworkCategory("engineering_domains_framework", "Engineering Domains", data.areas.engineeringDomains),
      buildFrameworkCategory("master_libraries_framework", "Master Libraries", data.areas.masterLibraries),
      buildFrameworkCategory("technical_data_framework", "Technical Data", data.areas.technicalData),
    ],
  };
}
