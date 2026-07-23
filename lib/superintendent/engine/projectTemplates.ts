import type { DryDockProjectType } from "@prisma/client";
import type { DdProjectModuleId } from "./projectModules";
import { CORE_MODULES, modulesForProjectType } from "./projectModules";

export const TEMPLATE_ENGINE_VERSION = "1.2";

export type TemplateJob = {
  title: string;
  category: string;
  workshop?: string;
  priority?: "low" | "medium" | "high" | "critical";
};

export type TemplateChecklistItem = {
  title: string;
  category?: string;
};

export type TemplateMilestone = {
  title: string;
  offsetDaysFromStart?: number;
  /** Index in the template milestones array this milestone depends on. */
  dependsOnIndex?: number;
};

export type TemplateSurveyItem = {
  title: string;
  surveyType: string;
};

export type TemplateBudgetCategory = {
  category: string;
  description?: string;
};

export type TemplateApproval = {
  title: string;
  approvalType: string;
  description?: string;
};

export type TemplateDocument = {
  title: string;
};

export type TemplateRfqStep = {
  title: string;
};

/**
 * Industry-standard maritime pre-dock readiness checklist (class survey dry docks).
 * Seeded into special / intermediate survey workspaces; also used to backfill missing items.
 */
export const STANDARD_PRE_DOCK_CHECKLIST: TemplateChecklistItem[] = [
  // Planning
  { title: "Pre-dock class documentation", category: "Planning" },
  { title: "Survey status & outstanding recommendations reviewed", category: "Planning" },
  { title: "Previous bottom survey records reviewed", category: "Planning" },
  { title: "Docking plan approved", category: "Planning" },
  { title: "Dry-dock specification / repair list frozen", category: "Planning" },
  { title: "Arrival draft, trim & stability planned", category: "Planning" },
  { title: "Owner / technical superintendent attendance plan", category: "Planning" },
  // Permits & safety
  { title: "Hot work permit", category: "Permits" },
  { title: "Confined space entry permit", category: "Permits" },
  { title: "Gas-free certificates", category: "Permits" },
  { title: "Energy isolation / LOTO plan agreed", category: "Permits" },
  { title: "Fire watch & fire main readiness confirmed", category: "Permits" },
  // Procurement
  { title: "Critical spares on board", category: "Procurement" },
  { title: "Long-lead materials & maker attendance confirmed", category: "Procurement" },
  { title: "Special tools & gauging gear verified on board", category: "Procurement" },
  // Inspections / survey
  { title: "Owner attendance — hull", category: "Inspections" },
  { title: "Class attendance — survey", category: "Inspections" },
  { title: "NDT inspection schedule", category: "Inspections" },
  { title: "Thickness measurement company appointed", category: "Inspections" },
  { title: "Tank cleaning / gas-freeing programme agreed", category: "Inspections" },
  // Sea trial
  { title: "Sea trial programme approved", category: "Sea Trial" },
  { title: "Post-dock sea trial attendance confirmed", category: "Sea Trial" },
  // Close-out
  { title: "Completion Checklist", category: "Close-out" },
  { title: "Class / flag certificates readiness pack", category: "Close-out" },
];

export const STANDARD_PRE_DOCK_DOCUMENTS: TemplateDocument[] = [
  { title: "Class status survey report" },
  { title: "Previous thickness records" },
  { title: "Approved docking plan" },
  { title: "Certificate of class" },
  { title: "Specification of work" },
  { title: "General arrangement & piping drawings pack" },
  { title: "Previous repair / dry-dock specification" },
];

export type ProjectTemplate = {
  version: string;
  type: DryDockProjectType;
  modules: DdProjectModuleId[];
  jobs: TemplateJob[];
  checklist: TemplateChecklistItem[];
  milestones: TemplateMilestone[];
  surveyItems: TemplateSurveyItem[];
  budgetCategories: TemplateBudgetCategory[];
  approvals: TemplateApproval[];
  documents: TemplateDocument[];
  rfqSteps: TemplateRfqStep[];
  defaultSurveyType?: string;
  defaultDockingReason?: string;
};

function tpl(
  type: DryDockProjectType,
  config: Omit<ProjectTemplate, "version" | "type" | "modules" | "approvals" | "documents" | "rfqSteps"> & {
    modules: DdProjectModuleId[];
    approvals?: TemplateApproval[];
    documents?: TemplateDocument[];
    rfqSteps?: TemplateRfqStep[];
  },
): ProjectTemplate {
  const { modules, approvals, documents, rfqSteps, ...rest } = config;
  return {
    version: TEMPLATE_ENGINE_VERSION,
    type,
    ...rest,
    modules: modulesForProjectType(modules),
    approvals: approvals ?? [],
    documents: documents ?? [],
    rfqSteps: rfqSteps ?? [],
  };
}

const SURVEY_MODULES: DdProjectModuleId[] = [
  "survey",
  "inspections",
  "sea_trial",
  "spares",
  "procurement",
  "delays",
  "variations",
  "daily_progress",
];

const DAMAGE_MODULES: DdProjectModuleId[] = [
  "inspections",
  "delays",
  "variations",
  "procurement",
  "daily_progress",
  "permits",
];

const RETROFIT_MODULES: DdProjectModuleId[] = [
  "procurement",
  "spares",
  "inspections",
  "permits",
  "resources",
  "sea_trial",
  "closeout",
];

export const PROJECT_TEMPLATES: Record<DryDockProjectType, ProjectTemplate> = {
  special_survey: tpl("special_survey", {
    modules: [...SURVEY_MODULES, "workshops", "rfq"],
    defaultSurveyType: "special_survey",
    defaultDockingReason: "Class special survey due",
    jobs: [
      { title: "Hull Inspection", category: "hull", workshop: "Hull" },
      { title: "Steel Renewal", category: "steel", workshop: "Steel" },
      { title: "Thickness Measurement", category: "hull", workshop: "Hull" },
      { title: "Tank Inspection", category: "tanks", workshop: "Tank" },
      { title: "Sea Valve Survey", category: "piping", workshop: "Valve" },
      { title: "Tailshaft Survey", category: "ME", workshop: "Machinery" },
      { title: "Main Engine Jobs", category: "ME", workshop: "Machinery" },
      { title: "Generator Jobs", category: "AE", workshop: "Machinery" },
      { title: "LSA Survey", category: "safety", workshop: "Safety" },
      { title: "FFA Survey", category: "safety", workshop: "Safety" },
      { title: "Class Survey", category: "miscellaneous", workshop: "QA/QC" },
      { title: "Painting Scope", category: "painting", workshop: "Painting" },
      { title: "Sea Trial", category: "miscellaneous", workshop: "QA/QC", priority: "high" },
    ],
    checklist: [...STANDARD_PRE_DOCK_CHECKLIST],
    milestones: [
      { title: "Arrival at yard", offsetDaysFromStart: 0 },
      { title: "Docking", offsetDaysFromStart: 2, dependsOnIndex: 0 },
      { title: "Class survey commencement", offsetDaysFromStart: 5, dependsOnIndex: 1 },
      { title: "Undocking", offsetDaysFromStart: 14, dependsOnIndex: 2 },
      { title: "Sea trial", offsetDaysFromStart: 16, dependsOnIndex: 3 },
      { title: "Departure", offsetDaysFromStart: 18, dependsOnIndex: 4 },
    ],
    surveyItems: [
      { title: "Special Survey — Hull", surveyType: "special_survey" },
      { title: "Special Survey — Machinery", surveyType: "machinery_survey" },
      { title: "Thickness Measurement", surveyType: "thickness_measurement" },
      { title: "Tailshaft Survey", surveyType: "machinery_survey" },
    ],
    budgetCategories: [
      { category: "docking", description: "Docking and undocking" },
      { category: "hull", description: "Hull repairs and steel" },
      { category: "painting", description: "Hull coating" },
      { category: "ME", description: "Main engine works" },
      { category: "AE", description: "Auxiliary engine / generators" },
      { category: "safety", description: "LSA / FFA" },
      { category: "miscellaneous", description: "General items" },
    ],
    approvals: [
      { title: "Scope of work approval", approvalType: "scope_change", description: "Technical Superintendent" },
      { title: "Budget approval", approvalType: "budget", description: "Technical Manager" },
      { title: "Yard nomination", approvalType: "other", description: "Fleet Manager" },
      { title: "Variation approval threshold", approvalType: "variation", description: "Company Admin" },
    ],
    documents: [...STANDARD_PRE_DOCK_DOCUMENTS],
    rfqSteps: [
      { title: "Issue RFQ to shortlisted yards" },
      { title: "Receive yard quotations" },
      { title: "Technical evaluation" },
      { title: "Commercial evaluation" },
      { title: "Yard nomination recommendation" },
    ],
  }),

  intermediate_survey: tpl("intermediate_survey", {
    modules: [...SURVEY_MODULES, "workshops", "rfq"],
    defaultSurveyType: "intermediate_survey",
    defaultDockingReason: "Class intermediate survey due",
    jobs: [
      { title: "Hull Inspection", category: "hull", workshop: "Hull" },
      { title: "Tank Spot Inspection", category: "tanks", workshop: "Tank" },
      { title: "Tailshaft Survey", category: "ME", workshop: "Machinery" },
      { title: "Main Engine Survey", category: "ME", workshop: "Machinery" },
      { title: "Class Survey Attendance", category: "miscellaneous", workshop: "QA/QC" },
    ],
    checklist: [
      { title: "Intermediate survey scope agreed", category: "Planning" },
      ...STANDARD_PRE_DOCK_CHECKLIST.filter(
        (item) =>
          item.title !== "Pre-dock class documentation" &&
          item.title !== "Previous bottom survey records reviewed",
      ),
    ],
    milestones: [
      { title: "Arrival at yard", offsetDaysFromStart: 0 },
      { title: "Survey commencement", offsetDaysFromStart: 1 },
      { title: "Departure", offsetDaysFromStart: 7 },
    ],
    surveyItems: [
      { title: "Intermediate Survey — Hull", surveyType: "intermediate_survey" },
      { title: "Intermediate Survey — Machinery", surveyType: "machinery_survey" },
    ],
    budgetCategories: [
      { category: "docking", description: "Docking" },
      { category: "hull", description: "Hull works" },
      { category: "ME", description: "Machinery survey" },
    ],
    documents: [...STANDARD_PRE_DOCK_DOCUMENTS],
    rfqSteps: [
      { title: "Issue RFQ to shortlisted yards" },
      { title: "Receive yard quotations" },
      { title: "Technical evaluation" },
      { title: "Commercial evaluation" },
      { title: "Yard nomination recommendation" },
    ],
  }),

  damage_repair: tpl("damage_repair", {
    modules: [...DAMAGE_MODULES, "workshops", "shipyard"],
    defaultDockingReason: "Damage repair — incident response",
    jobs: [
      { title: "Damage Assessment", category: "hull", workshop: "Hull", priority: "critical" },
      { title: "Insurance File", category: "miscellaneous", priority: "high" },
      { title: "Repair Scope", category: "miscellaneous", priority: "high" },
      { title: "Steel Repairs", category: "steel", workshop: "Steel", priority: "high" },
      { title: "Pipe Repairs", category: "piping", workshop: "Pipe", priority: "high" },
      { title: "Painting Repairs", category: "painting", workshop: "Painting" },
      { title: "Survey Attendance", category: "miscellaneous", workshop: "QA/QC", priority: "high" },
      { title: "Final Inspection", category: "miscellaneous", workshop: "QA/QC" },
    ],
    checklist: [
      { title: "Incident report filed", category: "Planning" },
      { title: "Insurance notification", category: "Commercial" },
      { title: "Class notified", category: "Survey" },
      { title: "Temporary repairs assessed", category: "Technical" },
    ],
    milestones: [
      { title: "Damage survey", offsetDaysFromStart: 0 },
      { title: "Repair plan approved", offsetDaysFromStart: 2 },
      { title: "Repair completion", offsetDaysFromStart: 10 },
      { title: "Final inspection", offsetDaysFromStart: 12 },
    ],
    surveyItems: [
      { title: "Damage Survey", surveyType: "other" },
      { title: "Class Damage Attendance", surveyType: "class_survey" },
    ],
    budgetCategories: [
      { category: "steel", description: "Structural repairs" },
      { category: "hull", description: "Hull damage" },
      { category: "painting", description: "Coating restoration" },
      { category: "miscellaneous", description: "Incident-related costs" },
    ],
  }),

  occasional_repair: tpl("occasional_repair", {
    modules: ["workshops", "procurement", "delays", "variations", "daily_progress"],
    defaultDockingReason: "Occasional repair scope",
    jobs: [
      { title: "Scope Confirmation", category: "miscellaneous" },
      { title: "Repair Execution", category: "steel", workshop: "Steel" },
      { title: "Testing & Verification", category: "miscellaneous", workshop: "QA/QC" },
    ],
    checklist: [{ title: "Repair scope approved", category: "Planning" }],
    milestones: [
      { title: "Work start", offsetDaysFromStart: 0 },
      { title: "Work completion", offsetDaysFromStart: 5 },
    ],
    surveyItems: [],
    budgetCategories: [{ category: "miscellaneous", description: "Occasional repair" }],
  }),

  underwater_survey: tpl("underwater_survey", {
    modules: ["survey", "inspections", "delays", "reports"],
    defaultSurveyType: "underwater_inspection",
    defaultDockingReason: "UWILD / in-water survey",
    jobs: [
      { title: "Underwater Hull Inspection", category: "hull", workshop: "Hull" },
      { title: "Propeller & Rudder Inspection", category: "hull", workshop: "Hull" },
      { title: "Anodes Inspection", category: "hull", workshop: "Hull" },
      { title: "Class Attendance", category: "miscellaneous", workshop: "QA/QC" },
    ],
    checklist: [
      { title: "Diver / ROV contractor appointed", category: "Planning" },
      { title: "Weather window confirmed", category: "Planning" },
    ],
    milestones: [
      { title: "UWILD commencement", offsetDaysFromStart: 0 },
      { title: "Report submission", offsetDaysFromStart: 1 },
    ],
    surveyItems: [{ title: "Underwater Inspection (UWILD)", surveyType: "underwater_inspection" }],
    budgetCategories: [{ category: "hull", description: "UWILD costs" }],
  }),

  new_installation: tpl("new_installation", {
    modules: [...RETROFIT_MODULES, "workshops", "rfq"],
    defaultDockingReason: "New installation / major retrofit",
    jobs: [
      { title: "Engineering Review", category: "miscellaneous", priority: "high" },
      { title: "Maker Drawings", category: "miscellaneous" },
      { title: "Material Procurement", category: "miscellaneous", priority: "high" },
      { title: "Installation Jobs", category: "piping", workshop: "Pipe", priority: "high" },
      { title: "Testing", category: "electrical", workshop: "Electrical" },
      { title: "Commissioning", category: "ME", workshop: "Machinery", priority: "high" },
      { title: "Sea Trial", category: "miscellaneous", priority: "high" },
      { title: "As-Built Documentation", category: "miscellaneous" },
    ],
    checklist: [
      { title: "Maker approved", category: "Technical" },
      { title: "Class approval obtained", category: "Survey" },
      { title: "Long-lead items ordered", category: "Procurement" },
    ],
    milestones: [
      { title: "Design freeze", offsetDaysFromStart: -30 },
      { title: "Installation start", offsetDaysFromStart: 0 },
      { title: "Commissioning", offsetDaysFromStart: 10 },
      { title: "Sea trial", offsetDaysFromStart: 14 },
    ],
    surveyItems: [{ title: "Retrofit Class Approval", surveyType: "class_survey" }],
    budgetCategories: [
      { category: "miscellaneous", description: "Equipment supply" },
      { category: "piping", description: "Installation" },
      { category: "electrical", description: "Electrical works" },
      { category: "ME", description: "Machinery integration" },
    ],
  }),

  emergency_docking: tpl("emergency_docking", {
    modules: [...DAMAGE_MODULES, "workshops", "shipyard", "resources"],
    defaultDockingReason: "Emergency — urgent docking required",
    jobs: [
      { title: "Emergency Assessment", category: "hull", priority: "critical" },
      { title: "Temporary Safeguarding", category: "safety", priority: "critical" },
      { title: "Class Notification", category: "miscellaneous", priority: "critical" },
      { title: "Emergency Repairs", category: "steel", workshop: "Steel", priority: "critical" },
      { title: "Post-repair Survey", category: "miscellaneous", workshop: "QA/QC", priority: "high" },
    ],
    checklist: [
      { title: "Incident commander assigned", category: "Planning" },
      { title: "Emergency yard slot confirmed", category: "Planning" },
      { title: "P&I / H&M notified", category: "Commercial" },
    ],
    milestones: [
      { title: "Emergency arrival", offsetDaysFromStart: 0 },
      { title: "Repair completion", offsetDaysFromStart: 5 },
    ],
    surveyItems: [{ title: "Emergency Class Attendance", surveyType: "class_survey" }],
    budgetCategories: [
      { category: "steel", description: "Emergency repairs" },
      { category: "docking", description: "Emergency docking" },
    ],
  }),

  layup_reactivation: tpl("layup_reactivation", {
    modules: ["workshops", "procurement", "spares", "inspections", "sea_trial", "closeout"],
    defaultDockingReason: "Lay-up or reactivation programme",
    jobs: [
      { title: "Lay-up Preservation Plan", category: "miscellaneous" },
      { title: "De-preservation / Reactivation", category: "ME", workshop: "Machinery" },
      { title: "Machinery Testing", category: "ME", workshop: "Machinery" },
      { title: "Safety Systems Reactivation", category: "safety", workshop: "Safety" },
      { title: "Sea Trial", category: "miscellaneous", priority: "high" },
    ],
    checklist: [
      { title: "Lay-up / reactivation plan approved", category: "Planning" },
      { title: "Crew complement confirmed", category: "Planning" },
    ],
    milestones: [
      { title: "Reactivation start", offsetDaysFromStart: 0 },
      { title: "Ready for sea", offsetDaysFromStart: 7 },
    ],
    surveyItems: [{ title: "Reactivation Survey", surveyType: "class_survey" }],
    budgetCategories: [
      { category: "ME", description: "Machinery reactivation" },
      { category: "safety", description: "Safety systems" },
    ],
  }),

  conversion_modification: tpl("conversion_modification", {
    modules: [...RETROFIT_MODULES, "workshops", "rfq", "shipyard"],
    defaultDockingReason: "Vessel conversion / modification",
    jobs: [
      { title: "Conversion Design Approval", category: "miscellaneous", priority: "high" },
      { title: "Structural Modification", category: "steel", workshop: "Steel", priority: "high" },
      { title: "Ballast / Cargo System Modification", category: "piping", workshop: "Pipe" },
      { title: "Electrical Reconfiguration", category: "electrical", workshop: "Electrical" },
      { title: "Class & Flag Approval", category: "miscellaneous", workshop: "QA/QC" },
      { title: "Sea Trial", category: "miscellaneous", priority: "high" },
    ],
    checklist: [
      { title: "Conversion specification approved", category: "Technical" },
      { title: "Flag state approval", category: "Survey" },
    ],
    milestones: [
      { title: "Conversion work start", offsetDaysFromStart: 0 },
      { title: "Class inspection", offsetDaysFromStart: 14 },
      { title: "Sea trial", offsetDaysFromStart: 21 },
    ],
    surveyItems: [{ title: "Conversion Survey", surveyType: "class_survey" }],
    budgetCategories: [
      { category: "steel", description: "Structural modification" },
      { category: "piping", description: "System modification" },
      { category: "electrical", description: "Electrical works" },
    ],
  }),

  warranty_repair: tpl("warranty_repair", {
    modules: ["workshops", "procurement", "inspections", "delays", "closeout"],
    defaultDockingReason: "Warranty rectification",
    jobs: [
      { title: "Warranty Defect List Review", category: "miscellaneous" },
      { title: "Maker Attendance", category: "ME", workshop: "Machinery" },
      { title: "Warranty Repairs", category: "steel", workshop: "Steel" },
      { title: "Maker Verification", category: "miscellaneous", workshop: "QA/QC" },
      { title: "Close-out Documentation", category: "miscellaneous" },
    ],
    checklist: [
      { title: "Warranty claim submitted", category: "Commercial" },
      { title: "Maker scope agreed", category: "Technical" },
    ],
    milestones: [
      { title: "Warranty work start", offsetDaysFromStart: 0 },
      { title: "Maker sign-off", offsetDaysFromStart: 5 },
    ],
    surveyItems: [],
    budgetCategories: [{ category: "miscellaneous", description: "Warranty rectification" }],
  }),
};

export function getProjectTemplate(type: DryDockProjectType): ProjectTemplate {
  return PROJECT_TEMPLATES[type] ?? PROJECT_TEMPLATES.special_survey;
}

export function getEnabledModules(type: DryDockProjectType): DdProjectModuleId[] {
  return getProjectTemplate(type).modules.length > 0
    ? getProjectTemplate(type).modules
    : CORE_MODULES;
}

export function listProjectTemplates(): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES);
}
