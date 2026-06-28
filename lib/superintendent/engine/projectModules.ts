/**
 * Module registry for the Dry Dock Project Management Engine.
 * Each module is a workspace area; project type templates enable a subset.
 */
export const DD_PROJECT_MODULES = [
  "overview",
  "scope",
  "workshops",
  "jobs",
  "timeline",
  "budget",
  "procurement",
  "rfq",
  "resources",
  "permits",
  "inspections",
  "survey",
  "spares",
  "daily_progress",
  "delays",
  "variations",
  "approvals",
  "shipyard",
  "sea_trial",
  "documents",
  "reports",
  "closeout",
] as const;

export type DdProjectModuleId = (typeof DD_PROJECT_MODULES)[number];

export type DdProjectModuleMeta = {
  id: DdProjectModuleId;
  label: string;
  description: string;
  /** Superintendent nav href when implemented */
  href?: string;
};

export const DD_PROJECT_MODULE_REGISTRY: Record<DdProjectModuleId, DdProjectModuleMeta> = {
  overview: { id: "overview", label: "Overview", description: "Progress, budget, alerts, milestones." },
  scope: { id: "scope", label: "Scope of Work", description: "Jobs, Excel import, job library, attachments." },
  workshops: { id: "workshops", label: "Workshops", description: "Hull, steel, machinery, electrical, QA/QC." },
  jobs: { id: "jobs", label: "Jobs", description: "Execution jobs and progress.", href: "/superintendent/jobs" },
  timeline: { id: "timeline", label: "Timeline", description: "Gantt, milestones, critical path, baseline." },
  budget: { id: "budget", label: "Budget", description: "Budget vs quote vs actual, contingency.", href: "/superintendent/budget" },
  procurement: { id: "procurement", label: "Procurement", description: "RFQ, PO, delivery, material tracking." },
  rfq: { id: "rfq", label: "RFQ", description: "Tender and yard quote workflow.", href: "/superintendent/rfq" },
  resources: { id: "resources", label: "Resources", description: "Workers, cranes, scaffolding, equipment." },
  permits: { id: "permits", label: "Permits", description: "Hot work, confined space, gas free, isolation." },
  inspections: { id: "inspections", label: "Inspections", description: "Owner, yard, class, flag, NDT, QA/QC." },
  survey: { id: "survey", label: "Survey", description: "Class and statutory survey items.", href: "/superintendent/survey" },
  spares: { id: "spares", label: "Spares", description: "Owner and yard supply tracking.", href: "/superintendent/spares" },
  daily_progress: { id: "daily_progress", label: "Daily Progress", description: "Daily reports, photos, weather.", href: "/superintendent/monitoring/daily-reports" },
  delays: { id: "delays", label: "Delay Register", description: "Delay log and impact.", href: "/superintendent/monitoring/delays" },
  variations: { id: "variations", label: "Variation Orders", description: "Growth/reduction and commercial impact.", href: "/superintendent/budget/variations" },
  approvals: { id: "approvals", label: "Approvals", description: "Technical, commercial, owner sign-off.", href: "/superintendent/approvals" },
  shipyard: { id: "shipyard", label: "Shipyard", description: "Yard coordination and execution sync." },
  sea_trial: { id: "sea_trial", label: "Sea Trial", description: "Trial programme, defects, acceptance." },
  documents: { id: "documents", label: "Documents", description: "Drawings, specs, certificates, manuals." },
  reports: { id: "reports", label: "Reports", description: "Progress and commercial reporting.", href: "/superintendent/reports" },
  closeout: { id: "closeout", label: "Close Project", description: "Outstanding items, warranty, lessons learned." },
};

/** Core modules every project receives regardless of type. */
export const CORE_MODULES: DdProjectModuleId[] = [
  "overview",
  "scope",
  "jobs",
  "budget",
  "timeline",
  "approvals",
  "documents",
  "reports",
];

export function resolveModuleMeta(id: DdProjectModuleId): DdProjectModuleMeta {
  return DD_PROJECT_MODULE_REGISTRY[id];
}

export function modulesForProjectType(typeModules: DdProjectModuleId[]): DdProjectModuleId[] {
  return [...new Set([...CORE_MODULES, ...typeModules])];
}
