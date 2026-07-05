import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { EmdrSprintMasterData } from "@/lib/emdr/types";

export type ParsedEmdrSprintWorkbook = ParsedMtilWorkbook & {
  emdrMasterData: EmdrSprintMasterData;
};

export type EmdrValidationIssue = {
  order: number;
  sheet: string;
  message: string;
  row?: number;
};

export type EmdrValidationResult = {
  valid: boolean;
  errors: EmdrValidationIssue[];
  warnings: EmdrValidationIssue[];
  summary: {
    equipmentCount: number;
    componentCount: number;
    toolCount: number;
    jobCount: number;
    templateCount: number;
  };
};

/** Validate EMDR import-order rules for equipment, component, and job cross-references. */
export function validateEmdrSprintWorkbook(data: ParsedEmdrSprintWorkbook): EmdrValidationResult {
  const errors: EmdrValidationIssue[] = [];
  const warnings: EmdrValidationIssue[] = [];
  const { equipmentMaster, componentMaster, tools } = data.emdrMasterData;

  const equipmentCodes = new Set(equipmentMaster.map((e) => e.equipmentCode));
  const componentCodes = new Set(componentMaster.map((c) => c.componentCode));
  const templateIds = new Set(data.templates.map((t) => t.templateId));
  const jobIds = new Set(data.masterJobs.map((j) => j.jobId));

  // Order 1 — Equipment codes unique
  const seenEquipment = new Set<string>();
  for (const row of equipmentMaster) {
    if (seenEquipment.has(row.equipmentCode)) {
      errors.push({
        order: 1,
        sheet: "01_Equipment_Master",
        row: row.rowNumber,
        message: `Duplicate Equipment Code: ${row.equipmentCode}`,
      });
    }
    seenEquipment.add(row.equipmentCode);
  }

  // Order 2 — Component codes unique + equipment exists
  const seenComponent = new Set<string>();
  for (const row of componentMaster) {
    if (seenComponent.has(row.componentCode)) {
      errors.push({
        order: 2,
        sheet: "02_Component_Master",
        row: row.rowNumber,
        message: `Duplicate Component Code: ${row.componentCode}`,
      });
    }
    seenComponent.add(row.componentCode);
    if (row.equipmentCode && !equipmentCodes.has(row.equipmentCode)) {
      errors.push({
        order: 2,
        sheet: "02_Component_Master",
        row: row.rowNumber,
        message: `Equipment Code not found in Equipment Master: ${row.equipmentCode}`,
      });
    }
  }

  // Jobs reference equipment codes (normalized on subComponent field)
  for (const job of data.masterJobs) {
    if (job.subComponent && !equipmentCodes.has(job.subComponent)) {
      warnings.push({
        order: 4,
        sheet: "03_Standard_Job_Library",
        row: job.rowNumber,
        message: `Job equipment code not in Equipment Master: ${job.subComponent} (${job.jobId})`,
      });
    }
    if (!templateIds.has(job.templateId)) {
      errors.push({
        order: 4,
        sheet: "03_Standard_Job_Library",
        row: job.rowNumber,
        message: `Template ID not found: ${job.templateId}`,
      });
    }
  }

  for (const tool of tools) {
    if (!templateIds.has(tool.templateId)) {
      warnings.push({
        order: 8,
        sheet: "08_Tools_Instruments",
        row: tool.rowNumber,
        message: `Tool template not found: ${tool.templateId}`,
      });
    }
  }

  for (const spare of data.spares) {
    if (!jobIds.has(spare.jobId)) {
      errors.push({
        order: 9,
        sheet: "10_Spare_Consumable_Map",
        row: spare.rowNumber,
        message: `Spare mapping job not found: ${spare.jobId}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      equipmentCount: equipmentMaster.length,
      componentCount: componentMaster.length,
      toolCount: tools.length,
      jobCount: data.masterJobs.length,
      templateCount: data.templates.length,
    },
  };
}
