/** Crew pages assignable by admin — maps permission keys to routes and API actions. */

export type CrewPageGroup =
  | "Overview"
  | "Machinery"
  | "Defects"
  | "Dry dock jobs"
  | "Dry dock scope"
  | "Purchase";

export type CrewPageDefinition = {
  key: string;
  label: string;
  description: string;
  route: string;
  group: CrewPageGroup;
  /** Additional action permissions granted with this page. */
  actionKeys?: string[];
};

export const CREW_ASSIGNABLE_PAGES: CrewPageDefinition[] = [
  {
    key: "page.shipAccess.dashboard",
    label: "Vessel overview",
    description: "View assigned vessel and active dry dock project",
    route: "/ship-access",
    group: "Overview",
  },
  {
    key: "page.shipAccess.machineryDashboard",
    label: "Machinery dashboard",
    description: "Machinery health score, overdue jobs, and condition tracking",
    route: "/ship-access/machinery",
    group: "Machinery",
    actionKeys: ["ship.machinery.read"],
  },
  {
    key: "page.shipAccess.machineryHours",
    label: "Machinery hours (legacy)",
    description: "Update main engine, auxiliary, and boiler running hours",
    route: "/ship-access/machinery-hours",
    group: "Machinery",
    actionKeys: ["ship.machinery.update", "ship.machinery.read"],
  },
  {
    key: "page.shipAccess.machineryRunningHours",
    label: "Machinery running hours",
    description: "Record running hours by asset with due tracking",
    route: "/ship-access/machinery/running-hours",
    group: "Machinery",
    actionKeys: ["ship.machinery.update", "ship.machinery.read"],
  },
  {
    key: "page.shipAccess.machineryParameters",
    label: "Machinery parameters",
    description: "Record cylinder temps, pressures, vibration, and oil analysis",
    route: "/ship-access/machinery/parameters",
    group: "Machinery",
    actionKeys: ["ship.machinery.update", "ship.machinery.read"],
  },
  {
    key: "page.shipAccess.machineryCondition",
    label: "Machinery condition",
    description: "Traffic-light machinery condition reports",
    route: "/ship-access/machinery/condition",
    group: "Machinery",
    actionKeys: ["ship.machinery.update", "ship.machinery.read"],
  },
  {
    key: "page.shipAccess.dryDockDashboard",
    label: "Dry dock preparation",
    description: "Dry dock readiness dashboard and scope building progress",
    route: "/ship-access/dry-dock",
    group: "Dry dock scope",
    actionKeys: ["ship.job.read"],
  },
  {
    key: "page.shipAccess.dryDockJobs",
    label: "Dry dock scope jobs",
    description: "View proposed jobs from master job library",
    route: "/ship-access/dry-dock/jobs",
    group: "Dry dock scope",
    actionKeys: ["ship.job.read"],
  },
  {
    key: "page.shipAccess.dryDockJobs.new",
    label: "Add dry dock job",
    description: "Select standard job from master library and complete dynamic form",
    route: "/ship-access/dry-dock/jobs/new",
    group: "Dry dock scope",
    actionKeys: ["ship.job.create"],
  },
  {
    key: "page.shipAccess.dryDockJobs.masterReview",
    label: "Master job review",
    description: "Endorse CE-approved dry dock scope jobs (Master only)",
    route: "/ship-access/dry-dock/jobs",
    group: "Dry dock scope",
    actionKeys: ["ship.job.masterApprove"],
  },
  {
    key: "page.shipAccess.defects.new",
    label: "Report defect",
    description: "Report machinery and equipment defects for Master approval",
    route: "/ship-access/defects/new",
    group: "Defects",
    actionKeys: ["ship.defect.create"],
  },
  {
    key: "page.shipAccess.defects.edit",
    label: "Update defects",
    description: "Edit draft or rejected defects before submission",
    route: "/ship-access/defects",
    group: "Defects",
    actionKeys: ["ship.defect.update"],
  },
  {
    key: "page.shipAccess.defects",
    label: "View defects",
    description: "Track defect submissions and Master approval status",
    route: "/ship-access/defects",
    group: "Defects",
    actionKeys: ["ship.defect.read"],
  },
  {
    key: "page.shipAccess.defects.masterReview",
    label: "Master defect review",
    description: "Approve or reject submitted defects (Master only)",
    route: "/ship-access/defects",
    group: "Defects",
    actionKeys: ["ship.defect.masterApprove"],
  },
  {
    key: "page.shipAccess.jobs.new",
    label: "Create dry dock job (legacy)",
    description: "Propose new scope jobs for superintendent review",
    route: "/ship-access/dry-dock/jobs/new",
    group: "Dry dock jobs",
    actionKeys: ["ship.job.create"],
  },
  {
    key: "page.shipAccess.jobs.edit",
    label: "Update jobs (legacy)",
    description: "Edit draft jobs before submission",
    route: "/ship-access/dry-dock/jobs",
    group: "Dry dock jobs",
    actionKeys: ["ship.job.update"],
  },
  {
    key: "page.shipAccess.jobs",
    label: "View jobs (legacy)",
    description: "View vessel job bank submissions and status",
    route: "/ship-access/dry-dock/jobs",
    group: "Dry dock jobs",
    actionKeys: ["ship.job.read"],
  },
  {
    key: "page.shipAccess.purchase",
    label: "View requisitions",
    description: "Track spares requisitions linked to approved defects",
    route: "/ship-access/purchase",
    group: "Purchase",
    actionKeys: ["ship.purchase.read"],
  },
  {
    key: "page.shipAccess.purchase.new",
    label: "Create requisition",
    description: "Raise spares requisitions from Master-approved defects",
    route: "/ship-access/purchase/new",
    group: "Purchase",
    actionKeys: ["ship.purchase.create"],
  },
  {
    key: "page.shipAccess.purchase.edit",
    label: "Update requisitions",
    description: "Edit draft or rejected requisitions before submission",
    route: "/ship-access/purchase",
    group: "Purchase",
    actionKeys: ["ship.purchase.update"],
  },
  {
    key: "page.shipAccess.purchase.masterReview",
    label: "Master requisition review",
    description: "Approve or reject submitted requisitions (Master only)",
    route: "/ship-access/purchase",
    group: "Purchase",
    actionKeys: ["ship.purchase.masterApprove"],
  },
  {
    key: "page.shipAccess.pms",
    label: "PMS schedule",
    description: "Planned maintenance schedule, overdue items, and job proposals",
    route: "/ship-access/pms",
    group: "Machinery",
    actionKeys: ["ship.machinery.read", "ship.job.create"],
  },
];

export const CREW_PAGE_BY_KEY = Object.fromEntries(
  CREW_ASSIGNABLE_PAGES.map((page) => [page.key, page]),
) as Record<string, CrewPageDefinition>;

/** Default page granted when a new crew credential is created. */
export const DEFAULT_CREW_PAGE_KEYS = [
  "page.shipAccess.dashboard",
  "page.shipAccess.machineryDashboard",
  "page.shipAccess.machineryRunningHours",
  "page.shipAccess.machineryParameters",
  "page.shipAccess.machineryCondition",
  "page.shipAccess.dryDockDashboard",
  "page.shipAccess.dryDockJobs",
  "page.shipAccess.dryDockJobs.new",
  "page.shipAccess.defects",
  "page.shipAccess.defects.new",
  "page.shipAccess.purchase",
  "page.shipAccess.pms",
];

export function expandCrewPagePermissionKeys(pageKeys: string[]): string[] {
  const expanded = new Set<string>();
  for (const key of pageKeys) {
    expanded.add(key);
    const page = CREW_PAGE_BY_KEY[key];
    for (const actionKey of page?.actionKeys ?? []) {
      expanded.add(actionKey);
    }
  }
  return [...expanded];
}

export function crewPagePermissionForPath(
  pathname: string,
  search?: URLSearchParams | string,
): string | null {
  const path = pathname.split("?")[0];
  if (path === "/ship-access/machinery" || path === "/ship-access/machinery/") {
    return "page.shipAccess.machineryDashboard";
  }
  if (path.startsWith("/ship-access/machinery/running-hours")) {
    return "page.shipAccess.machineryRunningHours";
  }
  if (path.startsWith("/ship-access/machinery/parameters")) {
    return "page.shipAccess.machineryParameters";
  }
  if (path.startsWith("/ship-access/machinery/condition")) {
    return "page.shipAccess.machineryCondition";
  }
  if (path === "/ship-access/pms" || path.startsWith("/ship-access/pms/")) {
    return "page.shipAccess.pms";
  }
  if (path === "/ship-access/dry-dock" || path === "/ship-access/dry-dock/") {
    return "page.shipAccess.dryDockDashboard";
  }
  if (path === "/ship-access/dry-dock/jobs/new") {
    return "page.shipAccess.dryDockJobs.new";
  }
  if (/^\/ship-access\/dry-dock\/jobs\/[^/]+\/?$/.test(path)) {
    return "page.shipAccess.dryDockJobs";
  }
  if (path.startsWith("/ship-access/dry-dock/jobs")) {
    return "page.shipAccess.dryDockJobs";
  }
  if (path === "/ship-access/machinery-hours" || path.startsWith("/ship-access/machinery-hours/")) {
    return "page.shipAccess.machineryHours";
  }
  if (path === "/ship-access/purchase/new") {
    return "page.shipAccess.purchase.new";
  }
  if (/^\/ship-access\/purchase\/[^/]+\/edit\/?$/.test(path)) {
    return "page.shipAccess.purchase.edit";
  }
  if (path === "/ship-access/purchase" || path.startsWith("/ship-access/purchase/")) {
    const params =
      typeof search === "string"
        ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
        : search;
    if (params?.get("status") === "draft" || params?.get("status") === "rejected") {
      return "page.shipAccess.purchase.edit";
    }
    if (params?.get("status") === "submitted") {
      return "page.shipAccess.purchase.masterReview";
    }
    return "page.shipAccess.purchase";
  }
  if (path === "/ship-access/defects/new") {
    return "page.shipAccess.defects.new";
  }
  if (/^\/ship-access\/defects\/[^/]+\/edit\/?$/.test(path)) {
    return "page.shipAccess.defects.edit";
  }
  if (path === "/ship-access/defects" || path.startsWith("/ship-access/defects/")) {
    const params =
      typeof search === "string"
        ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
        : search;
    if (params?.get("status") === "draft" || params?.get("status") === "rejected") {
      return "page.shipAccess.defects.edit";
    }
    if (params?.get("status") === "submitted") {
      return "page.shipAccess.defects.masterReview";
    }
    return "page.shipAccess.defects";
  }
  if (path === "/ship-access/jobs/new") {
    return "page.shipAccess.dryDockJobs.new";
  }
  if (/^\/ship-access\/jobs\/[^/]+\/edit\/?$/.test(path)) {
    return "page.shipAccess.jobs.edit";
  }
  if (path === "/ship-access/jobs" || path.startsWith("/ship-access/jobs/")) {
    const params =
      typeof search === "string"
        ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
        : search;
    if (params?.get("status") === "draft") {
      return "page.shipAccess.jobs.edit";
    }
    return "page.shipAccess.jobs";
  }
  if (path === "/ship-access") {
    return "page.shipAccess.dashboard";
  }
  return null;
}

export function crewApiPermissionForPath(
  pathname: string,
  method: string,
  search = "",
): string | null {
  if (pathname.startsWith("/api/ship-access/job-library")) {
    return "page.shipAccess.dryDockJobs.new";
  }
  if (pathname.startsWith("/api/ship-access/pms")) {
    return "page.shipAccess.pms";
  }
  if (pathname.startsWith("/api/ship-access/machinery/propose-overdue")) {
    return "ship.job.create";
  }
  if (pathname.startsWith("/api/ship-access/machinery/dashboard") || pathname.startsWith("/api/ship-access/machinery/assets")) {
    return "ship.machinery.read";
  }
  if (pathname.startsWith("/api/ship-access/machinery/")) {
    return method === "GET" ? "ship.machinery.read" : "ship.machinery.update";
  }
  if (pathname.startsWith("/api/ship-access/dry-dock/readiness")) {
    return "page.shipAccess.dryDockDashboard";
  }
  if (pathname.match(/^\/api\/ship-access\/vessel-jobs\/[^/]+\/master-review/)) {
    return "ship.job.masterApprove";
  }
  if (pathname.match(/^\/api\/ship-access\/vessel-jobs\/[^/]+\/attachments/)) {
    return method === "GET" ? "ship.job.read" : "ship.job.update";
  }
  if (pathname.match(/^\/api\/ship-access\/vessel-jobs\/[^/]+\/ce-review/)) {
    return "ship.job.update";
  }
  if (pathname.startsWith("/api/ship-access/machinery-hours")) {
    return method === "GET" ? "ship.machinery.read" : "ship.machinery.update";
  }
  if (pathname.match(/^\/api\/ship-access\/requisitions\/[^/]+\/master-review/)) {
    return "ship.purchase.masterApprove";
  }
  if (pathname.match(/^\/api\/ship-access\/requisitions\/[^/]+/)) {
    if (method === "GET") return "ship.purchase.read";
    if (method === "DELETE") return "ship.purchase.update";
    return "ship.purchase.update";
  }
  if (pathname.startsWith("/api/ship-access/requisitions")) {
    if (method === "GET") {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      if (params.get("eligibleDefects") === "true") return "ship.purchase.create";
      const status = params.get("status");
      if (status === "draft" || status === "rejected") return "ship.purchase.update";
      if (status === "submitted") return "ship.purchase.masterApprove";
      return "ship.purchase.read";
    }
    return "ship.purchase.create";
  }
  if (pathname.match(/^\/api\/ship-access\/defects\/[^/]+\/master-review/)) {
    return "ship.defect.masterApprove";
  }
  if (pathname.match(/^\/api\/ship-access\/defects\/[^/]+/)) {
    if (method === "GET") return "ship.defect.read";
    if (method === "DELETE") return "ship.defect.update";
    return "ship.defect.update";
  }
  if (pathname.startsWith("/api/ship-access/defects")) {
    if (method === "GET") {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      const status = params.get("status");
      if (status === "draft" || status === "rejected") return "ship.defect.update";
      if (status === "submitted") return "ship.defect.masterApprove";
      return "ship.defect.read";
    }
    return "ship.defect.create";
  }
  if (pathname.match(/^\/api\/ship-access\/jobs\/[^/]+/)) {
    return method === "GET" ? "ship.job.read" : "ship.job.update";
  }
  if (pathname.startsWith("/api/ship-access/jobs")) {
    if (method === "GET") {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      if (params.get("status") === "draft") return "ship.job.update";
      return "ship.job.read";
    }
    return "ship.job.create";
  }
  if (pathname.startsWith("/api/ship-access/context") || pathname.startsWith("/api/ship-access/vessel")) {
    return "page.shipAccess.dashboard";
  }
  return null;
}
