import type { JobInputFieldDef } from "./inputTemplate";
import { resolveDynamicTemplateAsync } from "@/lib/mtil/dynamicTemplateEngine";
import { prisma } from "@/lib/prisma";
import { resolveTemplateFromDb } from "@/lib/mtil/db/resolveTemplate";
import { buildWorkbookRuntimeFieldsFromAny } from "@/lib/mtil/phases/shared/workbookRegistry";
import { keyToTemplateId } from "@/lib/mtil/phases/shared/workbookUtils";
import { resolveDynamicTemplate } from "@/lib/mtil/dynamicTemplateEngine";

type JobNodeRef = {
  nodeType: string;
  dynamicTemplateKey?: string | null;
  referenceCode?: string | null;
  mtilJobCode?: string | null;
  inputTemplate?: unknown;
};

/**
 * Resolve the full dynamic input form for a job library node.
 * Order: DB template → workbook bundle → code registry → stored JSON → standard template.
 */
export async function resolveJobInputTemplateForNode(row: JobNodeRef): Promise<JobInputFieldDef[] | null> {
  if (row.nodeType !== "standard_job") {
    return (row.inputTemplate as JobInputFieldDef[] | null) ?? null;
  }

  const templateKey = row.dynamicTemplateKey ?? undefined;
  const jobId = row.referenceCode ?? row.mtilJobCode ?? undefined;

  // 1) Master job library row → commercial template ID
  if (jobId) {
    try {
      const master = await prisma.masterJobLibrary.findUnique({
        where: { jobId },
        select: { templateId: true },
      });
      if (master?.templateId) {
        const fromDb = await resolveTemplateFromDb(master.templateId);
        if (fromDb?.length) return fromDb;
        const fromWorkbook = buildWorkbookRuntimeFieldsFromAny(master.templateId);
        if (fromWorkbook?.length) return fromWorkbook;
      }
    } catch {
      // DB may be unavailable during bootstrap
    }
  }

  // 2) Dynamic template key (includes tmp_eng_aux_* and ae_* keys)
  if (templateKey) {
    const fromAsync = await resolveDynamicTemplateAsync(templateKey);
    if (fromAsync?.length) return fromAsync;

    const templateId = keyToTemplateId(templateKey);
    if (templateId) {
      const fromWorkbook = buildWorkbookRuntimeFieldsFromAny(templateId);
      if (fromWorkbook?.length) return fromWorkbook;
    }

    const fromCode = resolveDynamicTemplate(templateKey);
    if (fromCode.length) return fromCode;
  }

  // 3) Stored JSON on node (legacy jobs)
  const stored = row.inputTemplate as JobInputFieldDef[] | null;
  if (stored?.length) return stored;

  return resolveDynamicTemplate(templateKey ?? "me_general_inspect");
}
