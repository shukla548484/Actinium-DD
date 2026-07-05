import { PERMISSIONS } from "@/lib/rbac/permissions";

/** Keyword fragments in job scope text → suggested page permission keys. */
const JOB_SCOPE_KEYWORD_RULES: { pattern: RegExp; pageKeys: string[] }[] = [
  {
    pattern: /\b(admin|company|vessel|employee|organi[sz]ation|master data)\b/i,
    pageKeys: [
      "page.office.admin",
      "page.office.admin.companies",
      "page.office.admin.vessels",
      "page.office.admin.employees",
    ],
  },
  {
    pattern: /\b(tender|specification|comparison|yard invite|quotation)\b/i,
    pageKeys: [
      "page.office.projects",
      "page.office.project.spec",
      "page.office.project.yards",
      "page.office.project.comparison",
    ],
  },
  {
    pattern: /\b(dry dock|superintendent|dd planning|scope bank|monitoring)\b/i,
    pageKeys: [
      "page.superintendent.dashboard",
      "page.superintendent.projects",
      "page.superintendent.projectWorkspace",
      "page.superintendent.monitoring",
      "page.superintendent.closeout",
    ],
  },
  {
    pattern: /\b(procurement|requisition|purchase order|rfq|spares)\b/i,
    pageKeys: [
      "page.superintendent.procurement",
      "page.superintendent.vesselRequisitions",
      "page.office.procurement",
      "page.shipAccess.purchase",
      "page.shipAccess.purchase.new",
    ],
  },
  {
    pattern: /\b(budget|variation|invoice|accounts|cost control)\b/i,
    pageKeys: [
      "page.superintendent.budget",
      "page.office.accounts",
      "page.superintendent.approvals",
    ],
  },
  {
    pattern: /\b(defect|machinery|running hours|pms|maintenance)\b/i,
    pageKeys: [
      "page.shipAccess.pms",
      "page.shipAccess.defects",
      "page.shipAccess.defects.new",
      "page.shipAccess.machineryDashboard",
      "page.shipAccess.machineryRunningHours",
      "page.superintendent.vesselJobs",
    ],
  },
  {
    pattern: /\b(document|certificate|ism|audit)\b/i,
    pageKeys: [
      "page.superintendent.documents",
      "page.office.department.hseq",
      "page.external.auditor",
    ],
  },
  {
    pattern: /\b(fleet|kpi|performance)\b/i,
    pageKeys: ["page.office.department.fleet"],
  },
  {
    pattern: /\b(crew|certification|manning)\b/i,
    pageKeys: ["page.office.department.crewing", "page.office.admin.crewCredentials"],
  },
  {
    pattern: /\b(shipyard|workshop|hull|steel|paint|execution)\b/i,
    pageKeys: [
      "page.shipyard.dashboard",
      "page.shipyard.workshops",
      "page.shipyard.planning",
      "page.shipyard.execution",
    ],
  },
  {
    pattern: /\b(class|survey|statutory|flag)\b/i,
    pageKeys: ["page.external.class", "page.external.flag"],
  },
  {
    pattern: /\b(owner|client representative)\b/i,
    pageKeys: ["page.external.owner"],
  },
  {
    pattern: /\b(platform|sync|monitor|infra|security)\b/i,
    pageKeys: [
      "page.platform.admin",
      "page.platform.monitor",
      "page.platform.operator",
      "page.desktop.sync",
    ],
  },
  {
    pattern: /\b(vendor|supplier|external|quote)\b/i,
    pageKeys: ["page.external.portal", "page.yard.quote"],
  },
];

const PAGE_KEYS = new Set(PERMISSIONS.filter((p) => p.key.startsWith("page.")).map((p) => p.key));

/** Suggest page permissions from a role's job scope text. */
export function suggestPageKeysFromJobScope(jobScope: string | null | undefined): string[] {
  if (!jobScope?.trim()) return [];
  const suggested = new Set<string>();
  for (const rule of JOB_SCOPE_KEYWORD_RULES) {
    if (rule.pattern.test(jobScope)) {
      for (const key of rule.pageKeys) {
        if (PAGE_KEYS.has(key)) suggested.add(key);
      }
    }
  }
  return [...suggested].sort();
}
