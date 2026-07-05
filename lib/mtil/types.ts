import type { DdJobPriority } from "@prisma/client";
import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";

/** MTIL phase identifiers — aligned with master development plan. */
export type MtilPhaseId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type MtilPhaseStatus = "completed" | "in_progress" | "pending";

export type MtilJobAction =
  | "inspect"
  | "survey"
  | "overhaul"
  | "renew"
  | "repair"
  | "test"
  | "calibrate"
  | "clean"
  | "adjust"
  | "replace"
  | "measure"
  | "report";

export type MtilPhotoSlot = "before" | "during" | "after" | "defect" | "report";

export type MtilAutoFillSource =
  | "vessel.name"
  | "vessel.imo"
  | "machinery.runningHours"
  | "machinery.lastOverhaul"
  | "machinery.maker"
  | "machinery.model"
  | "machinery.serialNumber";

export type MtilMeasurementRef = {
  code: string;
  /** v0.2 measurement ID */
  measurementId: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  nominal?: number;
  tolerance?: string;
  required?: boolean;
};

export type MtilChecklistItem = {
  code: string;
  /** v0.2 inspection item ID */
  inspectionId: string;
  label: string;
  holdPoint?: boolean;
  classRequired?: boolean;
  qaQcRequired?: boolean;
};

export type MtilSparesLine = {
  code: string;
  description: string;
  unit?: string;
  typicalQty?: number;
};

export type MtilRfqMapping = {
  rfqCategory: string;
  lineDescription: string;
  unit?: string;
  costCode?: string;
};

export type MtilBudgetMapping = {
  budgetCategory: string;
  costCode: string;
  workshop?: string;
};

/** Canonical job row — one row in the workbook / PostgreSQL import. */
export type MtilJobDefinition = {
  /** v0.2 commercial ID, e.g. JOB-ENG-ME-0001 */
  jobId: string;
  /** Legacy stable internal code */
  mtilJobCode: string;
  phase: MtilPhaseId;
  department: string;
  systemCode: string;
  systemName: string;
  machineryCode: string;
  machineryName: string;
  componentCode: string;
  componentName: string;
  subComponent?: string;
  action: MtilJobAction;
  title: string;
  description?: string;
  workshop: string;
  /** v0.2 template ID, e.g. TMP-ENG-ME-0001 */
  templateId: string;
  dynamicTemplateKey: string;
  vesselTypeApplicability: string[];
  projectTypeApplicability: string[];
  defaultPriority: DdJobPriority;
  estimatedManhours: number;
  referenceCode?: string;
  classHoldPoint?: boolean;
  qaQcHoldPoint?: boolean;
  permitRequired?: boolean;
  responsibleUser?: string;
  approvalWorkflow?: string[];
  requiredAttachments?: string[];
  requiredPhotos?: string[];
  requiredReports?: string[];
  measurementRefs?: string[];
  checklistRefs?: string[];
  sparesRefs?: string[];
  rfqMapping?: MtilRfqMapping;
  budgetMapping?: MtilBudgetMapping;
};

/** Dynamic template definition — generates form fields at runtime. */
export type MtilDynamicTemplateDef = {
  key: string;
  /** v0.2 commercial template ID */
  templateId: string;
  label: string;
  description?: string;
  photoSlots?: MtilPhotoSlot[];
  autoFill?: MtilAutoFillSource[];
  measurementRefs?: string[];
  checklistRefs?: string[];
  extraFields?: JobInputFieldDef[];
  classHoldPoint?: boolean;
  qaQcRequired?: boolean;
  permitRequired?: boolean;
  requiredAttachments?: string[];
  requiredReports?: string[];
  approvalWorkflow?: string[];
};

export type MtilComponentDef = {
  code: string;
  name: string;
  actions: MtilJobAction[];
  dynamicTemplateKey?: string;
  measurementRefs?: string[];
  estimatedManhoursBase?: number;
  priority?: DdJobPriority;
};

export type MtilMachineryDef = {
  code: string;
  name: string;
  components: MtilComponentDef[];
};

export type MtilSystemDef = {
  code: string;
  name: string;
  workshop: string;
  machinery: MtilMachineryDef[];
};

export type MtilPhaseMeta = {
  id: MtilPhaseId;
  slug: string;
  name: string;
  status: MtilPhaseStatus;
  targetJobCount: { min: number; max: number };
  description: string;
};

/** Stored on JobLibraryNode.mtilMeta after seed. */
export type MtilNodeMeta = {
  phase: MtilPhaseId;
  jobId?: string;
  mtilJobCode?: string;
  templateId?: string;
  dynamicTemplateKey?: string;
  action?: MtilJobAction;
  subComponent?: string;
  measurementRefs?: string[];
  checklistRefs?: string[];
  sparesMapping?: MtilSparesLine[];
  rfqMapping?: MtilRfqMapping;
  budgetMapping?: MtilBudgetMapping;
  classHoldPoint?: boolean;
  qaQcHoldPoint?: boolean;
  vesselTypeApplicability?: string[];
  projectTypeApplicability?: string[];
  approvalWorkflow?: string[];
};
