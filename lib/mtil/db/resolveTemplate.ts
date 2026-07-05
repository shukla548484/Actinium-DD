import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";
import { STANDARD_JOB_INPUT_TEMPLATE } from "@/lib/vessel/jobLibrary/inputTemplate";
import { prisma } from "@/lib/prisma";
import type { JobManualInputFieldDef } from "@/lib/jobCatalog/types";
import { getPhase1TemplateByKey } from "@/lib/mtil/phases/phase1/templateCatalog";
import { getPhase2TemplateByKey } from "@/lib/mtil/phases/phase2/templateCatalog";
import { getPhase3TemplateByKey } from "@/lib/mtil/phases/phase3/templateCatalog";
import {
  buildWorkbookRuntimeFieldsFromAny,
  findWorkbookTemplateDef,
} from "@/lib/mtil/phases/shared/workbookRegistry";
import { keyToTemplateId, templateIdToKey } from "@/lib/mtil/phases/shared/workbookUtils";
import { resolveDynamicTemplate } from "@/lib/mtil/dynamicTemplateEngine";

function manualFieldsToInputTemplate(fields: JobManualInputFieldDef[]): JobInputFieldDef[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type as JobInputFieldDef["type"],
    required: f.required,
    unit: f.unit,
    options: f.options,
    section: (f.section as JobInputFieldDef["section"]) ?? "condition",
  }));
}

function measurementFieldsFromDb(
  rows: Array<{
    measurementName: string;
    unit: string;
    targetValue: string | null;
    mandatoryFlag: boolean;
    measurementId: string;
  }>,
): JobInputFieldDef[] {
  return rows.map((m) => ({
    key: `meas_${m.measurementId}`,
    label: `${m.measurementName} (${m.unit})${m.targetValue ? ` — ${m.targetValue}` : ""}`,
    type: "number",
    required: m.mandatoryFlag,
    unit: m.unit,
    section: "condition",
  }));
}

function checklistFieldFromDb(checklistId: string, items: Array<{ inspectionItem: string }>): JobInputFieldDef[] {
  if (items.length === 0) return [];
  return [
    {
      key: `checklist_${checklistId}`,
      label: "Inspection checklist",
      type: "textarea",
      section: "condition",
    },
  ];
}

/** Resolve runtime form fields from persisted JobDynamicTemplate row. */
export async function resolveTemplateFromDb(templateId: string): Promise<JobInputFieldDef[] | null> {
  const row = await prisma.jobDynamicTemplate.findUnique({
    where: { templateId, activeFlag: true },
    include: {
      measurements: { orderBy: { measurementName: "asc" } },
      checklistItems: { orderBy: { sequenceNo: "asc" } },
    },
  });
  if (!row) return null;

  const manual = manualFieldsToInputTemplate((row.manualInputFields as JobManualInputFieldDef[]) ?? []);
  const measurements = measurementFieldsFromDb(row.measurements);
  const checklists = row.checklistId
    ? checklistFieldFromDb(row.checklistId, row.checklistItems)
    : [];

  const base = STANDARD_JOB_INPUT_TEMPLATE.filter(
    (f) =>
      !manual.some((m) => m.key === f.key) &&
      !f.key.startsWith("meas_") &&
      !f.key.startsWith("checklist_") &&
      f.key !== "photosNote" &&
      f.key !== "attachmentsNote",
  );

  const photos: JobInputFieldDef[] =
    Array.isArray(row.requiredPhotos) && (row.requiredPhotos as unknown[]).length > 0
      ? [{ key: "photosNote", label: "Photos", type: "photos_note", section: "condition" }]
      : [];

  return [...base, ...measurements, ...manual, ...checklists, ...photos];
}

/** Lookup by MTIL template key → commercial template ID → DB → workbook bundle → code registry. */
export async function resolveTemplateByKey(templateKey: string): Promise<JobInputFieldDef[] | null> {
  const workbookDef = findWorkbookTemplateDef(templateKey);

  const def =
    getPhase1TemplateByKey(templateKey) ??
    getPhase2TemplateByKey(templateKey) ??
    getPhase3TemplateByKey(templateKey) ??
    workbookDef ??
    null;

  const templateId =
    def?.templateId ??
    (templateKey.startsWith("TMP-") ? templateKey : keyToTemplateId(templateKey));

  if (templateId) {
    const fromDb = await resolveTemplateFromDb(templateId);
    if (fromDb?.length) return fromDb;

    const fromWorkbook = buildWorkbookRuntimeFieldsFromAny(templateId);
    if (fromWorkbook?.length) return fromWorkbook;
  }

  if (def) return resolveDynamicTemplate(templateKey);

  if (templateKey.startsWith("TMP-")) {
    const fromWorkbook = buildWorkbookRuntimeFieldsFromAny(templateKey);
    if (fromWorkbook?.length) return fromWorkbook;
  }

  const asTemplateId = keyToTemplateId(templateKey);
  if (asTemplateId) {
    const fromDb = await resolveTemplateFromDb(asTemplateId);
    if (fromDb?.length) return fromDb;
    const fromWorkbook = buildWorkbookRuntimeFieldsFromAny(asTemplateId);
    if (fromWorkbook?.length) return fromWorkbook;
  }

  return resolveDynamicTemplate(templateKey);
}

export { templateIdToKey, keyToTemplateId };
