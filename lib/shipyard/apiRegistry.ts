import type { ShipyardModuleDef } from "@/lib/shipyard/workflow";
import { SHIPYARD_MODULES } from "@/lib/shipyard/workflow";

export type ShipyardApiRouteDef = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  purpose: string;
  status: "planned" | "live";
};

export type ShipyardPageApiMap = {
  module: ShipyardModuleDef;
  routes: ShipyardApiRouteDef[];
};

/** Pages ↔ API tables reference for shipyard ERP (implementation tracker). */
export const SHIPYARD_PAGE_API_REGISTRY: ShipyardPageApiMap[] = [
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "rfq_inbox")!,
    routes: [
      { method: "GET", path: "/api/shipyard/rfq", purpose: "List RFQ queue for logged-in yard", status: "live" },
      { method: "PATCH", path: "/api/shipyard/rfq/[inviteId]", purpose: "Advance workflow stage, assign estimator", status: "live" },
      { method: "GET", path: "/api/shipyard/estimators", purpose: "List shipyard estimators for assignment", status: "live" },
      { method: "GET", path: "/api/projects/[id]/yards", purpose: "Office: issue RFQ invite (creates queue entry)", status: "live" },
      { method: "GET", path: "/api/shipyard/quotations", purpose: "List vessel-job quotation requests", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "cost_estimation")!,
    routes: [
      { method: "GET", path: "/api/shipyard/estimation/[inviteId]", purpose: "Load cost build-up (version-aware)", status: "live" },
      { method: "POST", path: "/api/shipyard/estimation/[inviteId]", purpose: "Save estimate / apply template", status: "live" },
      { method: "GET", path: "/api/shipyard/estimation/[inviteId]/versions", purpose: "List quote versions v1/v2/v3", status: "live" },
      { method: "POST", path: "/api/shipyard/estimation/[inviteId]/versions", purpose: "Create new quote version from template or clone", status: "live" },
      { method: "GET", path: "/api/shipyard/cost-templates", purpose: "Reusable owner rate cards", status: "live" },
      { method: "GET", path: "/api/shipyard/general-services", purpose: "Yard general service catalog", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "quote_builder")!,
    routes: [
      { method: "GET", path: "/api/shipyard/quotations/[id]", purpose: "Quotation workspace detail", status: "live" },
      { method: "PATCH", path: "/api/shipyard/quotations/[id]", purpose: "Save lines/terms/tariff or submit", status: "live" },
      { method: "GET", path: "/api/shipyard/quotations/by-token/[token]", purpose: "Token portal quotation read", status: "live" },
      { method: "PATCH", path: "/api/shipyard/quotations/by-token/[token]", purpose: "Token portal quotation write/submit", status: "live" },
      { method: "GET", path: "/api/shipyard/tariffs", purpose: "Yard tariff catalog", status: "live" },
      { method: "PATCH", path: "/api/shipyard/tariffs", purpose: "Update yard tariff rates", status: "live" },
      { method: "GET", path: "/api/quote/[token]", purpose: "Token portal quote read", status: "live" },
      { method: "POST", path: "/api/quote/[token]", purpose: "Token portal quote submit", status: "live" },
      { method: "POST", path: "/api/shipyard/quotation/[inviteId]/submit", purpose: "Authenticated yard quote submit", status: "planned" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "awarded_projects")!,
    routes: [
      { method: "GET", path: "/api/shipyard/awarded", purpose: "Accepted invites → execution projects", status: "planned" },
      { method: "POST", path: "/api/shipyard/projects/[projectId]/execution", purpose: "Initialize yard work from awarded spec", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "project_planning")!,
    routes: [
      { method: "GET", path: "/api/shipyard/jobs/[jobId]", purpose: "Workshop job detail", status: "live" },
      { method: "POST", path: "/api/shipyard/jobs/[jobId]/dependencies", purpose: "Dependency graph / critical path", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "daily_progress")!,
    routes: [
      { method: "GET", path: "/api/shipyard/projects/[projectId]/registers/progress", purpose: "Daily progress register", status: "live" },
      { method: "POST", path: "/api/shipyard/projects/[projectId]/registers/progress", purpose: "Add progress entry", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "variation_orders")!,
    routes: [
      { method: "GET", path: "/api/shipyard/projects/[projectId]/registers/variations", purpose: "Variation register", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "qa_qc")!,
    routes: [
      { method: "GET", path: "/api/shipyard/projects/[projectId]/registers/inspections", purpose: "QC inspection register", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "dashboard")!,
    routes: [
      { method: "GET", path: "/api/shipyard/dashboard", purpose: "Portal PM KPIs and summaries", status: "live" },
    ],
  },
  {
    module: SHIPYARD_MODULES.find((m) => m.id === "profile")!,
    routes: [
      { method: "GET", path: "/api/shipyard/profile", purpose: "Yard profile, docks, workshops", status: "live" },
      { method: "PATCH", path: "/api/shipyard/profile", purpose: "Update yard infrastructure", status: "live" },
    ],
  },
];
