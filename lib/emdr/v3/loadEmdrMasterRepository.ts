import fs from "node:fs";
import {
  EMDR_V30_MASTER_REPOSITORY_PATH,
  EMDR_V31_MASTER_REPOSITORY_PATH,
  EMDR_V32_MASTER_REPOSITORY_PATH,
  EMDR_V33_MASTER_REPOSITORY_PATH,
  EMDR_V34_MASTER_REPOSITORY_PATH,
  EMDR_V36_MASTER_REPOSITORY_PATH,
  EMDR_V37_MASTER_REPOSITORY_PATH,
  EMDR_V38_MASTER_REPOSITORY_PATH,
  EMDR_V39_MASTER_REPOSITORY_PATH,
  isEmdrV33MasterRepositoryPresent,
  type EmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import { mergeParsedEmdrRepositories } from "@/lib/emdr/v3/mergeMasterRepositories";
import { parseV38IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV38IncrementalRepository";
import {
  parseV3MasterRepositoryFileIfExists,
  type ParsedV3MasterRepository,
} from "@/lib/emdr/v3/parseMasterRepository";
import { parseV39IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV39IncrementalRepository";
import { EMDR_V38_RELEASE, EMDR_V39_RELEASE } from "@/lib/emdr/v3/sheets";

/** Full cumulative workbooks only — V3.8/V3.9 are incremental supplements. */
const CUMULATIVE_STANDALONE_REPOSITORIES: { kind: EmdrMasterRepositoryKind; path: string }[] = [
  { kind: "v37", path: EMDR_V37_MASTER_REPOSITORY_PATH },
  { kind: "v36", path: EMDR_V36_MASTER_REPOSITORY_PATH },
  { kind: "v34", path: EMDR_V34_MASTER_REPOSITORY_PATH },
];

let cachedLoadedKind: EmdrMasterRepositoryKind | null | undefined;

function loadV38SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV38IncrementalRepositoryIfExists(EMDR_V38_MASTER_REPOSITORY_PATH);
}

function loadV39SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV39IncrementalRepositoryIfExists(EMDR_V39_MASTER_REPOSITORY_PATH);
}

function loadCumulativeStandaloneParsed(): ParsedV3MasterRepository | null {
  for (const entry of CUMULATIVE_STANDALONE_REPOSITORIES) {
    const parsed = parseV3MasterRepositoryFileIfExists(entry.path);
    if (parsed) return parsed;
  }

  const v33 = parseV3MasterRepositoryFileIfExists(EMDR_V33_MASTER_REPOSITORY_PATH);
  const v32 = isEmdrV33MasterRepositoryPresent()
    ? null
    : parseV3MasterRepositoryFileIfExists(EMDR_V32_MASTER_REPOSITORY_PATH);
  const v31 = parseV3MasterRepositoryFileIfExists(EMDR_V31_MASTER_REPOSITORY_PATH);
  const v30 = parseV3MasterRepositoryFileIfExists(EMDR_V30_MASTER_REPOSITORY_PATH);

  const base = v31 ?? v30;
  const supplement = v33 ?? v32;

  if (base && supplement) return mergeParsedEmdrRepositories(base, supplement);
  if (v33) return v33;
  if (v32) return v32;
  if (v31) return v31;
  if (v30) return v30;
  return null;
}

function isV38Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  return (
    job.jobId.startsWith("JOBS-V38-") ||
    /fresh water generator|\bfwg\b|air conditioning|refrigeration|\bhvac\b/i.test(job.machinery)
  );
}

function isV39Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  return job.jobId.startsWith("JOBS-DMW-") || /windlass|winch|capstan|deck machinery/i.test(job.machinery);
}

function finalizeMergedRepository(
  merged: ParsedV3MasterRepository,
  release: string,
): ParsedV3MasterRepository {
  return {
    ...merged,
    libraryVersion: release,
    release,
    masterJobs: merged.masterJobs.map((job) => ({
      ...job,
      libraryVersion: isV39Job(job) ? EMDR_V39_RELEASE : isV38Job(job) ? EMDR_V38_RELEASE : job.libraryVersion,
    })),
  };
}

function loadMergedMasterRepository(): ParsedV3MasterRepository | null {
  let merged = loadCumulativeStandaloneParsed();
  const v38 = loadV38SupplementParsed();
  const v39 = loadV39SupplementParsed();

  if (v38 && merged) merged = mergeParsedEmdrRepositories(merged, v38);
  else if (v38) merged = v38;

  if (v39 && merged) merged = mergeParsedEmdrRepositories(merged, v39);
  else if (v39) merged = v39;

  if (!merged) return null;

  if (v39) return finalizeMergedRepository(merged, EMDR_V39_RELEASE);
  if (v38) return finalizeMergedRepository(merged, EMDR_V38_RELEASE);
  return merged;
}

/** Highest V3.x repository that parses successfully (skips corrupt files on disk). */
export function resolveLoadedEmdrMasterRepositoryKind(): EmdrMasterRepositoryKind | null {
  if (cachedLoadedKind !== undefined) return cachedLoadedKind;

  if (loadV39SupplementParsed()) {
    cachedLoadedKind = "v39";
    return cachedLoadedKind;
  }
  if (loadV38SupplementParsed()) {
    cachedLoadedKind = "v38";
    return cachedLoadedKind;
  }

  for (const entry of CUMULATIVE_STANDALONE_REPOSITORIES) {
    if (!fs.existsSync(entry.path)) continue;
    if (parseV3MasterRepositoryFileIfExists(entry.path)) {
      cachedLoadedKind = entry.kind;
      return cachedLoadedKind;
    }
  }

  const v33 = parseV3MasterRepositoryFileIfExists(EMDR_V33_MASTER_REPOSITORY_PATH);
  const v32 = isEmdrV33MasterRepositoryPresent()
    ? null
    : parseV3MasterRepositoryFileIfExists(EMDR_V32_MASTER_REPOSITORY_PATH);
  const v31 = parseV3MasterRepositoryFileIfExists(EMDR_V31_MASTER_REPOSITORY_PATH);
  const v30 = parseV3MasterRepositoryFileIfExists(EMDR_V30_MASTER_REPOSITORY_PATH);
  const base = v31 ?? v30;
  const supplement = v33 ?? v32;

  if (base && supplement) {
    cachedLoadedKind = v33 ? "v33" : "v32";
    return cachedLoadedKind;
  }
  if (v33) {
    cachedLoadedKind = "v33";
    return cachedLoadedKind;
  }
  if (v32) {
    cachedLoadedKind = "v32";
    return cachedLoadedKind;
  }
  if (v31) {
    cachedLoadedKind = "v31";
    return cachedLoadedKind;
  }
  if (v30) {
    cachedLoadedKind = "v30";
    return cachedLoadedKind;
  }

  cachedLoadedKind = null;
  return null;
}

/** @deprecated Prefer resolveLoadedEmdrMasterRepositoryKind for runtime behavior. */
export { resolveEmdrMasterRepositoryKind } from "@/lib/emdr/paths";

/** Load cumulative base plus optional V3.8 and V3.9 incremental supplements. */
export function loadEmdrMasterRepositoryParsed(): ParsedV3MasterRepository | null {
  return loadMergedMasterRepository();
}

export function loadEmdrMasterRepositoryParsedFromPath(path: string): ParsedV3MasterRepository {
  const v39 = parseV39IncrementalRepositoryIfExists(path);
  if (v39) return v39;
  const v38 = parseV38IncrementalRepositoryIfExists(path);
  if (v38) return v38;
  const parsed = parseV3MasterRepositoryFileIfExists(path);
  if (!parsed) throw new Error(`Failed to parse EMDR master repository: ${path}`);
  return parsed;
}
