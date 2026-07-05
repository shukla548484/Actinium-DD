import fs from "node:fs";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { MtilDynamicTemplateDef } from "@/lib/mtil/types";
import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";
import {
  loadPhase1WorkbookV04,
  PHASE1_WORKBOOK_V04_PATH,
} from "@/lib/mtil/phases/phase1/workbookV04";
import {
  loadPhase2WorkbookV05,
  PHASE2_WORKBOOK_V05_PATH,
} from "@/lib/mtil/phases/phase2/workbookV05";
import {
  loadPhase3WorkbookV06,
  PHASE3_WORKBOOK_V06_PATH,
} from "@/lib/mtil/phases/phase3/workbookV06";
import {
  loadPhase4WorkbookV07,
  PHASE4_WORKBOOK_V07_PATH,
} from "@/lib/mtil/phases/phase4/workbookV07";
import {
  loadPhase5WorkbookV08,
  PHASE5_WORKBOOK_V08_PATH,
} from "@/lib/mtil/phases/phase5/workbookV08";
import {
  loadPhase6WorkbookV09,
  PHASE6_WORKBOOK_V09_PATH,
} from "@/lib/mtil/phases/phase6/workbookV09";
import {
  loadPhase7WorkbookV10,
  PHASE7_WORKBOOK_V10_PATH,
} from "@/lib/mtil/phases/phase7/workbookV10";
import {
  loadPhase8WorkbookV11,
  PHASE8_WORKBOOK_V11_PATH,
} from "@/lib/mtil/phases/phase8/workbookV11";
import {
  buildWorkbookRuntimeFields,
  keyToTemplateId,
  templateIdToKey,
  workbookTemplatesToDynamicDefs,
} from "./workbookUtils";

export type WorkbookLoader = () => ParsedMtilWorkbook;

type WorkbookLoaderEntry = {
  path: string;
  load: WorkbookLoader;
};

const MTIL_WORKBOOK_LOADER_ENTRIES: WorkbookLoaderEntry[] = [
  { path: PHASE1_WORKBOOK_V04_PATH, load: loadPhase1WorkbookV04 },
  { path: PHASE2_WORKBOOK_V05_PATH, load: loadPhase2WorkbookV05 },
  { path: PHASE3_WORKBOOK_V06_PATH, load: loadPhase3WorkbookV06 },
  { path: PHASE4_WORKBOOK_V07_PATH, load: loadPhase4WorkbookV07 },
  { path: PHASE5_WORKBOOK_V08_PATH, load: loadPhase5WorkbookV08 },
  { path: PHASE6_WORKBOOK_V09_PATH, load: loadPhase6WorkbookV09 },
  { path: PHASE7_WORKBOOK_V10_PATH, load: loadPhase7WorkbookV10 },
  { path: PHASE8_WORKBOOK_V11_PATH, load: loadPhase8WorkbookV11 },
];

/** @deprecated Prefer MTIL_WORKBOOK_LOADER_ENTRIES — loaders only when files exist on disk. */
export const MTIL_WORKBOOK_LOADERS: WorkbookLoader[] = MTIL_WORKBOOK_LOADER_ENTRIES.map(
  ({ load }) => load,
);

function isWorkbookAvailable(path: string): boolean {
  return fs.existsSync(path);
}

function loadWorkbookTemplates(entry: WorkbookLoaderEntry): MtilDynamicTemplateDef[] {
  if (!isWorkbookAvailable(entry.path)) return [];
  return workbookTemplatesToDynamicDefs(entry.load());
}

export function getAllWorkbookTemplateDefs(): MtilDynamicTemplateDef[] {
  return MTIL_WORKBOOK_LOADER_ENTRIES.flatMap(loadWorkbookTemplates);
}

export function findWorkbookTemplateDef(templateKey: string): MtilDynamicTemplateDef | null {
  const key = templateKey.startsWith("TMP-") ? templateIdToKey(templateKey) : templateKey;
  return getAllWorkbookTemplateDefs().find((t) => t.key === key || t.templateId === templateKey) ?? null;
}

export function buildWorkbookRuntimeFieldsFromAny(templateKeyOrId: string): JobInputFieldDef[] | null {
  for (const entry of MTIL_WORKBOOK_LOADER_ENTRIES) {
    if (!isWorkbookAvailable(entry.path)) continue;
    const fields = buildWorkbookRuntimeFields(templateKeyOrId, entry.load());
    if (fields?.length) return fields;
  }
  return null;
}

export function resolveWorkbookTemplateId(templateKey: string): string | null {
  if (templateKey.startsWith("TMP-")) return templateKey;
  const asId = keyToTemplateId(templateKey);
  if (!asId) return null;
  for (const entry of MTIL_WORKBOOK_LOADER_ENTRIES) {
    if (!isWorkbookAvailable(entry.path)) continue;
    const data = entry.load();
    if (data.templates.some((t) => t.templateId === asId)) return asId;
  }
  return asId;
}
