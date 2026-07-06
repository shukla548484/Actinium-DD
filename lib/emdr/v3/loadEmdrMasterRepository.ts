import {
  EMDR_V30_MASTER_REPOSITORY_PATH,
  EMDR_V31_MASTER_REPOSITORY_PATH,
  EMDR_V32_MASTER_REPOSITORY_PATH,
  EMDR_V33_MASTER_REPOSITORY_PATH,
  isEmdrV33MasterRepositoryPresent,
} from "@/lib/emdr/paths";
import { mergeParsedEmdrRepositories } from "@/lib/emdr/v3/mergeMasterRepositories";
import {
  parseV3MasterRepositoryFile,
  parseV3MasterRepositoryFileIfExists,
  type ParsedV3MasterRepository,
} from "@/lib/emdr/v3/parseMasterRepository";

export { resolveEmdrMasterRepositoryKind } from "@/lib/emdr/paths";

/** Load and merge V3.x workbooks — supplements merge additively onto V3.1 (or V3.0). */
export function loadEmdrMasterRepositoryParsed(): ParsedV3MasterRepository | null {
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

export function loadEmdrMasterRepositoryParsedFromPath(path: string): ParsedV3MasterRepository {
  return parseV3MasterRepositoryFile(path);
}
