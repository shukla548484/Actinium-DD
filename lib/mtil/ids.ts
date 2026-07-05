export {
  MTIL_ENGINE_VERSION,
  MTIL_VESSEL_TYPES,
  MTIL_PROJECT_TYPES,
  MTIL_APPROVAL_WORKFLOWS,
  MASTER_CODE_STANDARD_VERSION,
  MASTER_ENTITY_CODES,
  MASTER_EQUIPMENT_SYSTEM_CODES,
  buildJobId,
  buildTemplateId,
  buildInspectionId,
  buildMeasurementId,
  buildRfqId,
  buildBudgetCode,
  buildMtilJobCode,
  buildCostCode,
  buildStandardJobId,
  buildDynamicTemplateId,
  normalizeMasterId,
  parseMasterCode,
} from "./standards";
export type {
  MtilDeptCode,
  MtilSystemCode,
  MtilVesselType,
  MtilProjectType,
  MtilApprovalWorkflow,
} from "./standards";

import type { MtilJobAction } from "./types";

export function actionLabel(action: MtilJobAction): string {
  const labels: Record<MtilJobAction, string> = {
    inspect: "Inspect",
    survey: "Survey",
    overhaul: "Overhaul",
    renew: "Renew",
    repair: "Repair",
    test: "Test",
    calibrate: "Calibrate",
    clean: "Clean",
    adjust: "Adjust",
    replace: "Replace",
    measure: "Measure",
    report: "Report",
  };
  return labels[action];
}

export function jobTitle(componentName: string, action: MtilJobAction): string {
  return `${actionLabel(action)} — ${componentName}`;
}
