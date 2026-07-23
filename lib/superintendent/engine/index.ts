export {
  DRY_DOCK_PROJECT_TYPES,
  DRY_DOCK_PROJECT_TYPE_ITEMS,
  DRY_DOCK_TYPE_CODES,
  formatProjectTypeLabel,
  getProjectTypeMeta,
} from "./projectTypes";
export type { DryDockProjectTypeMeta, DryDockTypeCode } from "./projectTypes";

export {
  CORE_MODULES,
  DD_PROJECT_MODULES,
  DD_PROJECT_MODULE_REGISTRY,
  modulesForProjectType,
  resolveModuleMeta,
} from "./projectModules";
export type { DdProjectModuleId, DdProjectModuleMeta } from "./projectModules";

export {
  DD_CREATE_STATUS_OPTIONS,
  DD_STATUS_LABELS,
  DD_STATUS_LIFECYCLE,
  DD_STATUS_LEGACY,
  DD_STATUS_SIDE_STATES,
  DD_STATUS_TRANSITIONS,
  canTransitionStatus,
  getStatusLabel,
} from "./statusWorkflow";

export {
  PROJECT_TEMPLATES,
  STANDARD_PRE_DOCK_CHECKLIST,
  STANDARD_PRE_DOCK_DOCUMENTS,
  TEMPLATE_ENGINE_VERSION,
  getEnabledModules,
  getProjectTemplate,
  listProjectTemplates,
} from "./projectTemplates";
export type {
  ProjectTemplate,
  TemplateBudgetCategory,
  TemplateChecklistItem,
  TemplateJob,
  TemplateMilestone,
  TemplateSurveyItem,
} from "./projectTemplates";

export { provisionDryDockProjectWorkspace } from "./provisionWorkspace";
export { ensureProjectChecklistFromTemplate } from "./ensureChecklist";
export { getProjectWorkspaceSummary } from "./workspaceSummary";
export type { ProjectWorkspaceSummary, WorkspaceModuleCard, WorkspaceWorkshop } from "./workspaceSummary";
export { projectScopedHref, projectPlanningHref, projectMonitoringHref, projectBudgetHref } from "./workspaceLinks";
export { DRY_DOCK_DESIGN_RULES, assertDryDockFeatureOwnership } from "./designPrinciples";
