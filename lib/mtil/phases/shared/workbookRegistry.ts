import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { MtilDynamicTemplateDef } from "@/lib/mtil/types";
import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";
import { loadPhase1WorkbookV04 } from "@/lib/mtil/phases/phase1/workbookV04";
import { loadPhase2WorkbookV05 } from "@/lib/mtil/phases/phase2/workbookV05";
import { loadPhase3WorkbookV06 } from "@/lib/mtil/phases/phase3/workbookV06";
import { loadPhase4WorkbookV07 } from "@/lib/mtil/phases/phase4/workbookV07";
import { loadPhase5WorkbookV08 } from "@/lib/mtil/phases/phase5/workbookV08";
import {
  buildWorkbookRuntimeFields,
  keyToTemplateId,
  templateIdToKey,
  workbookTemplatesToDynamicDefs,
} from "./workbookUtils";

export type WorkbookLoader = () => ParsedMtilWorkbook;

export const MTIL_WORKBOOK_LOADERS: WorkbookLoader[] = [
  loadPhase1WorkbookV04,
  loadPhase2WorkbookV05,
  loadPhase3WorkbookV06,
  loadPhase4WorkbookV07,
  loadPhase5WorkbookV08,
];

export function getAllWorkbookTemplateDefs(): MtilDynamicTemplateDef[] {
  return MTIL_WORKBOOK_LOADERS.flatMap((load) => workbookTemplatesToDynamicDefs(load()));
}

export function findWorkbookTemplateDef(templateKey: string): MtilDynamicTemplateDef | null {
  const key = templateKey.startsWith("TMP-") ? templateIdToKey(templateKey) : templateKey;
  return getAllWorkbookTemplateDefs().find((t) => t.key === key || t.templateId === templateKey) ?? null;
}

export function buildWorkbookRuntimeFieldsFromAny(templateKeyOrId: string): JobInputFieldDef[] | null {
  for (const load of MTIL_WORKBOOK_LOADERS) {
    const fields = buildWorkbookRuntimeFields(templateKeyOrId, load());
    if (fields?.length) return fields;
  }
  return null;
}

export function resolveWorkbookTemplateId(templateKey: string): string | null {
  if (templateKey.startsWith("TMP-")) return templateKey;
  const asId = keyToTemplateId(templateKey);
  if (!asId) return null;
  for (const load of MTIL_WORKBOOK_LOADERS) {
    const data = load();
    if (data.templates.some((t) => t.templateId === asId)) return asId;
  }
  return asId;
}
