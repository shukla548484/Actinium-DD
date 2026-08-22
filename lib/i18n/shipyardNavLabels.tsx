"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  loadShipyardQuoteLangPrefs,
  resolveActiveLocale,
  shipyardQuoteUi,
  type ShipyardQuoteLangPrefs,
  type ShipyardQuoteLocale,
  type ShipyardQuoteUiKey,
} from "@/lib/i18n/shipyardQuotationUi";
import type { TopNavId, TopNavItem } from "@/lib/navigation/topNavItems";
import type { ShipyardModuleId } from "@/lib/shipyard/workflow";

const TOP_NAV_ID_KEYS: Record<TopNavId, ShipyardQuoteUiKey> = {
  admin: "navAdmin",
  jobs: "navJobCreations",
  shipyard: "navShipyard",
  shipAccess: "navShipAccess",
  purchase: "navPurchase",
  company: "navCompany",
  office: "navOffice",
  superintendent: "navTechSuperintendent",
  tasks: "navTasksPending",
};

const NAV_HREF_KEYS: Record<string, ShipyardQuoteUiKey> = {
  "/projects": "navAllProjects",
  "/projects/new": "navNewProject",
  "/shipyard": "navSyDashboard",
  "/shipyard/rfq": "navSyRfqInbox",
  "/shipyard/awarded": "navSyAwardedProjects",
  "/shipyard/planning": "navSyPlanning",
  "/shipyard/workshops": "navSyWorkshops",
  "/shipyard/profile": "navSyYardProfile",
  "/shipyard/estimation": "navSyCostEstimation",
  "/shipyard/approvals": "navSyInternalApproval",
  "/shipyard/quotation": "navSyQuoteBuilder",
  "/shipyard/planning/dependencies": "navSyDependencies",
  "/shipyard/planning/resources": "navSyResourceAllocation",
  "/shipyard/workshops/docking-team": "navSyDockingTeam",
  "/shipyard/workshops/hull": "navSyHull",
  "/shipyard/workshops/steel": "navSySteel",
  "/shipyard/workshops/painting": "navSyPainting",
  "/shipyard/workshops/machinery": "navSyMachinery",
  "/shipyard/workshops/valve": "navSyValve",
  "/shipyard/workshops/electrical": "navSyElectrical",
  "/shipyard/workshops/safety-qa": "navSySafetyQa",
  "/shipyard/qa": "navSyQaOverview",
  "/shipyard/execution/inspections": "navSyInspectionRegister",
  "/admin": "navAdminOverview",
  "/admin/companies": "navCompanyManagement",
  "/admin/shipyards": "navAdminShipyards",
  "/admin/external-vendors": "navAdminExternalVendors",
  "/admin/vessels": "navVesselManagement",
  "/admin/employees": "navEmployeeManagement",
  "/admin/crew-credentials": "navAdminCrewCredentials",
  "/admin/job-catalog": "navAdminJobCatalog",
  "/admin/job-library": "navAdminJobLibrary",
  "/admin/master-catalog": "navAdminMasterCatalog",
  "/admin/roles": "navAdminRoles",
  "/admin/access": "navAdminAccess",
  "/ship-access": "navSaOverview",
  "/ship-access/machinery-hours": "navSaMachineryHours",
  "/ship-access/defects/new": "navSaReportDefect",
  "/ship-access/defects?status=draft": "navSaUpdateDefects",
  "/ship-access/defects": "navSaViewDefects",
  "/ship-access/defects?status=submitted": "navSaMasterReview",
  "/ship-access/jobs/new": "navSaCreateJob",
  "/ship-access/jobs?status=draft": "navSaUpdateJobs",
  "/ship-access/jobs": "navSaViewJobs",
  "/ship-access/purchase/new": "navSaCreateRequisition",
  "/ship-access/purchase?status=draft": "navSaUpdateRequisitions",
  "/ship-access/purchase": "navSaViewRequisitions",
  "/ship-access/purchase?status=submitted": "navSaMasterRequisitionReview",
  "/purchase/dashboard": "navPuDashboard",
  "/superintendent": "navTsDashboard",
};

const MODULE_ID_KEYS: Record<ShipyardModuleId, ShipyardQuoteUiKey> = {
  dashboard: "navSyDashboard",
  profile: "navSyProfile",
  rfq_inbox: "navSyRfqInbox",
  cost_estimation: "navSyCostEstimation",
  internal_approval: "navSyInternalApproval",
  quote_builder: "navSyQuoteBuilder",
  awarded_projects: "navSyAwardedProjects",
  project_planning: "navSyProjectPlanning",
  resource_allocation: "navSyResourceAllocation",
  material_planning: "navSyMaterialPlanning",
  daily_progress: "navSyDailyProgress",
  variation_orders: "navSyVariationOrders",
  workshop_production: "navSyWorkshopProduction",
  qa_qc: "navSyQaQc",
  billing: "navSyBilling",
  project_closeout: "navSyProjectCloseout",
};

const LABEL_FALLBACK_KEYS: Record<string, ShipyardQuoteUiKey> = {
  Dashboard: "navSyDashboard",
  "RFQ inbox": "navSyRfqInbox",
  "RFQ Inbox": "navSyRfqInbox",
  "Awarded projects": "navSyAwardedProjects",
  "Awarded Projects": "navSyAwardedProjects",
  Planning: "navSyPlanning",
  Workshops: "navSyWorkshops",
  "Yard profile": "navSyYardProfile",
  "Shipyard Profile": "navSyProfile",
  "Master schedule": "navSyMasterSchedule",
  "Dependencies & critical path": "navSyDependencies",
  "Resource allocation": "navSyResourceAllocation",
  "Workshop overview": "navSyWorkshopOverview",
  "Docking team": "navSyDockingTeam",
  Hull: "navSyHull",
  Steel: "navSySteel",
  Painting: "navSyPainting",
  Machinery: "navSyMachinery",
  Valve: "navSyValve",
  Electrical: "navSyElectrical",
  "Safety / QA-QC": "navSySafetyQa",
  "QA overview": "navSyQaOverview",
  "Inspection register": "navSyInspectionRegister",
  "All projects": "navAllProjects",
  "New project": "navNewProject",
  "Company management": "navCompanyManagement",
  "Vessel management": "navVesselManagement",
  "Employee management": "navEmployeeManagement",
  "Tasks Pending": "navTasksPending",
};

function resolveNavKey(options: {
  topNavId?: TopNavId;
  moduleId?: ShipyardModuleId;
  href?: string;
  fallback: string;
}): ShipyardQuoteUiKey | null {
  return (
    (options.topNavId ? TOP_NAV_ID_KEYS[options.topNavId] : undefined) ??
    (options.moduleId ? MODULE_ID_KEYS[options.moduleId] : undefined) ??
    LABEL_FALLBACK_KEYS[options.fallback] ??
    (options.href ? NAV_HREF_KEYS[options.href] : undefined) ??
    null
  );
}

function DualNavText({ primary, secondary }: { primary: string; secondary: string }) {
  if (primary === secondary) return <>{primary}</>;
  return (
    <span className="inline-flex min-w-0 flex-col leading-tight">
      <span className="truncate">{primary}</span>
      <span className="truncate text-[10px] font-normal opacity-70">{secondary}</span>
    </span>
  );
}

export function shipyardNavLabel(
  locale: ShipyardQuoteLocale,
  options: {
    topNavId?: TopNavId;
    moduleId?: ShipyardModuleId;
    href?: string;
    fallback: string;
  },
): string {
  const key = resolveNavKey(options);
  if (!key) return options.fallback;
  return shipyardQuoteUi(locale, key);
}

/**
 * Dual-language nav label: active language on top, English (or local) underneath in dual mode.
 */
export function shipyardNavDualLabel(
  prefs: ShipyardQuoteLangPrefs,
  options: {
    topNavId?: TopNavId;
    moduleId?: ShipyardModuleId;
    href?: string;
    uiKey?: ShipyardQuoteUiKey;
    fallback: string;
  },
): ReactNode {
  const locale = resolveActiveLocale(prefs);
  const key = options.uiKey ?? resolveNavKey(options);
  const primary = key ? shipyardQuoteUi(locale, key) : options.fallback;
  if (prefs.mode !== "dual") return primary;
  const otherLocale: ShipyardQuoteLocale = locale === "en" ? prefs.secondary : "en";
  const secondary = key ? shipyardQuoteUi(otherLocale, key) : options.fallback;
  return <DualNavText primary={primary} secondary={secondary} />;
}

export function localizeTopNavItems(
  items: TopNavItem[],
  locale: ShipyardQuoteLocale,
): TopNavItem[] {
  return items.map((item) => ({
    ...item,
    label: shipyardNavLabel(locale, { topNavId: item.id, fallback: item.label }),
    children: item.children?.map((child) => ({
      ...child,
      label: shipyardNavLabel(locale, { href: child.href, fallback: child.label }),
    })),
    sections: item.sections?.map((section) => ({
      ...section,
      title: section.title
        ? shipyardNavLabel(locale, { fallback: section.title })
        : section.title,
      items: section.items.map((child) => ({
        ...child,
        label: shipyardNavLabel(locale, { href: child.href, fallback: child.label }),
      })),
    })),
  }));
}

/** Active shipyard UI locale — follows language bar prefs + pack refresh events. */
export function useShipyardActiveLocale(): ShipyardQuoteLocale {
  const [locale, setLocale] = useState<ShipyardQuoteLocale>("en");

  const refresh = useCallback(() => {
    setLocale(resolveActiveLocale(loadShipyardQuoteLangPrefs()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { ensureShipyardQuoteLangPrefs } = await import("@/lib/i18n/shipyardQuotationUi");
      const prefs = await ensureShipyardQuoteLangPrefs();
      if (!cancelled) setLocale(resolveActiveLocale(prefs));
    })();
    window.addEventListener("actinium-shipyard-lang", refresh);
    window.addEventListener("actinium-shipyard-i18n-packs", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("actinium-shipyard-lang", refresh);
      window.removeEventListener("actinium-shipyard-i18n-packs", refresh);
    };
  }, [refresh]);

  return locale;
}

/** Full language prefs for dual nav labels (sidebar / mobile). */
export function useShipyardLangPrefs(): ShipyardQuoteLangPrefs {
  const [prefs, setPrefs] = useState<ShipyardQuoteLangPrefs>({
    mode: "en_only",
    secondary: "zh",
    active: "en",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { ensureShipyardQuoteLangPrefs } = await import("@/lib/i18n/shipyardQuotationUi");
      const next = await ensureShipyardQuoteLangPrefs();
      if (!cancelled) setPrefs(next);
    })();
    const onLang = () => setPrefs(loadShipyardQuoteLangPrefs());
    window.addEventListener("actinium-shipyard-lang", onLang);
    window.addEventListener("actinium-shipyard-i18n-packs", onLang);
    return () => {
      cancelled = true;
      window.removeEventListener("actinium-shipyard-lang", onLang);
      window.removeEventListener("actinium-shipyard-i18n-packs", onLang);
    };
  }, []);

  return prefs;
}
