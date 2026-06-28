export type ProjectStatus = "draft" | "tendering" | "comparing" | "closed";
export type YardInviteStatus = "invited" | "in_progress" | "submitted" | "excel_imported" | "shortlisted" | "accepted" | "rejected";
export type QuoteSource = "portal" | "excel";
export type PricingStatus = "priced" | "included" | "na" | "owner_supply";
export type MatchMethod = "portal" | "excel_auto" | "excel_manual" | "owner";

export type SpecBucket = string;

/** @deprecated Use project categories — kept for import fallbacks. */
export type LegacySpecBucket =
  | "docking"
  | "general_services"
  | "utilities"
  | "hull_prep"
  | "hull_paint"
  | "steel"
  | "machinery"
  | "other";

export type CalcRule =
  | "lump_sum"
  | "per_day"
  | "unit_qty"
  | "unit_qty_days"
  | "watch"
  | "connection_daily"
  | "connect_disconnect"
  | "per_m2";

export interface CalcParams {
  daysField?: "dry_dock_days" | "cpr_days" | "shipyard_days" | "total_service" | "connection_days";
  defaultConnections?: number;
  connectDisconnectMultiplier?: number;
  shiftHours?: number;
  serviceDefId?: string;
  defaultQty?: number;
  minimumUnits?: number;
}

export interface Project {
  id: string;
  name: string;
  vesselName: string | null;
  /** Fleet vessel UUID for relay/Bucardo scope (optional until fleet assigned). */
  vesselId: string | null;
  referenceCode: string | null;
  currency: string;
  shipyardDays: number | null;
  dryDockDays: number | null;
  cprDays: number | null;
  status: ProjectStatus;
  notes: string | null;
  /** Locales enabled for scope display on the yard portal. */
  scopeLocales: import("@/lib/i18n/scope").ScopeLocale[];
  originNode: import("@/lib/sync/constants").SyncOriginNode;
  officeChangedAt: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompareSnapshotRecord {
  id: string;
  projectId: string;
  inviteId: string | null;
  vendorName: string;
  fileName: string;
  snapshot: import("@/lib/desktop/snapshot").CompareAppSnapshot;
  originNode: import("@/lib/sync/constants").SyncOriginNode;
  officeChangedAt: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecLineDescriptions {
  en: string;
  zh: string | null;
  ja: string | null;
}

export interface SpecLine {
  id: string;
  projectId: string;
  bucket: SpecBucket;
  sortOrder: number;
  lineCode: string | null;
  /** English description (primary). */
  description: string;
  descriptions: SpecLineDescriptions;
  unit: string | null;
  /** Owner scope quantity (connections, units, etc.). */
  defaultQty: number | null;
  /** Owner scope days for this line (overrides project duration). */
  scopeDays: number | null;
  /** Owner scope area m² (hull / coating lines). */
  scopeAreaM2: number | null;
  /** Job / technical scope notes shown to yard (read-only). */
  scopeNotes: string | null;
  /** When true, yard cannot change qty/days/description. */
  ownerLocked: boolean;
  allowDiscount: boolean;
  maxDiscountPct: number | null;
  /** Owner budget benchmark (optional, read-only for yard). */
  referenceUnitRate: number | null;
  calcRule: CalcRule;
  calcParams: CalcParams;
  serviceDefId: string | null;
  isOptional: boolean;
}

/** Company-wide master catalog line (admin-maintained). */
export interface MasterSpecLine {
  id: string;
  bucket: string;
  sortOrder: number;
  lineCode: string | null;
  description: string;
  descriptions: SpecLineDescriptions;
  unit: string | null;
  defaultQty: number | null;
  scopeDays: number | null;
  scopeAreaM2: number | null;
  scopeNotes: string | null;
  allowDiscount: boolean;
  maxDiscountPct: number | null;
  referenceUnitRate: number | null;
  calcRule: CalcRule;
  calcParams: CalcParams;
  serviceDefId: string | null;
  isOptional: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface YardInvite {
  id: string;
  projectId: string;
  yardName: string;
  contactEmail: string | null;
  token: string;
  sourceType: QuoteSource;
  status: YardInviteStatus;
  /** Language shown on the yard quotation portal. */
  preferredLocale: import("@/lib/i18n/scope").ScopeLocale;
  submittedAt: string | null;
  createdAt: string;
}

export interface QuoteMeta {
  inviteId: string;
  currency: string | null;
  shipyardDays: number | null;
  dryDockDays: number | null;
  cprDays: number | null;
  exchangeRate: number | null;
  validityDays: number | null;
  generalNotes: string | null;
  excelFileName: string | null;
  globalDiscountPct: number | null;
  taxPct: number | null;
  quoteGrossTotal: number | null;
  quoteNetTotal: number | null;
}

export interface QuoteLine {
  id: string;
  inviteId: string;
  specLineId: string | null;
  isExtra: boolean;
  description: string;
  unit: string | null;
  unitRate: number | null;
  quantity: number | null;
  quotedTotal: number | null;
  calculatedTotal: number | null;
  discountPct: number | null;
  grossTotal: number | null;
  netTotal: number | null;
  pricingStatus: PricingStatus;
  remarks: string | null;
  matchConfidence: number | null;
  matchMethod: MatchMethod;
  sortOrder: number;
}

export interface ProjectDetail extends Project {
  specLines: SpecLine[];
  yardInvites: YardInvite[];
  categories: ProjectCategory[];
}

export interface ProjectCategory {
  id: string;
  projectId: string;
  categoryNo: string;
  slug: string;
  name: string;
  shortcut: string;
  sortOrder: number;
  isSystem: boolean;
}

export interface YardQuoteDetail {
  invite: YardInvite;
  project: Project;
  specLines: SpecLine[];
  categories: ProjectCategory[];
  meta: QuoteMeta | null;
  lines: QuoteLine[];
}

export interface ComparisonCell {
  unitRate: number | null;
  quantity: number | null;
  quotedTotal: number | null;
  calculatedTotal: number | null;
  discountPct: number | null;
  grossTotal: number | null;
  netTotal: number | null;
  pricingStatus: PricingStatus;
  remarks: string | null;
  source: QuoteSource;
  matchMethod: MatchMethod;
  matchConfidence: number | null;
  yardName: string;
  inviteId: string;
}

export interface ComparisonRow {
  specLineId: string | null;
  lineCode: string | null;
  description: string;
  descriptions?: SpecLineDescriptions;
  bucket: SpecBucket;
  unit: string | null;
  calcRule: CalcRule;
  scopeQty: number | null;
  scopeDays: number | null;
  scopeAreaM2: number | null;
  scopeNotes: string | null;
  isExtra: boolean;
  byYard: Record<string, ComparisonCell | null>;
}

export interface BucketTotal {
  bucket: SpecBucket;
  categoryNo: string | null;
  label: string;
  shortcut: string | null;
  byYard: Record<string, number | null>;
}

export interface HybridComparison {
  project: ProjectDetail;
  yards: { id: string; name: string; sourceType: QuoteSource; status: YardInviteStatus }[];
  rows: ComparisonRow[];
  extraRows: ComparisonRow[];
  bucketTotals: BucketTotal[];
  grandTotals: Record<string, number | null>;
}

/** @deprecated Use project categories via categoryLabelFromList. */
export const BUCKET_LABELS: Record<string, string> = {
  docking_cost: "01 Docking Cost",
  general_service_cost: "02 General Service Cost",
  hull_cleaning_painting: "03 Hull Cleaning & Painting",
  steel_renewal: "04 Steel Renewal",
  cargo_hold_tank_coating: "05 Cargo Hold/Tank Coating",
  sea_valves_overboard: "06 Sea Valves & Overboard Valves",
  rudder_propeller: "07 Rudder & Propeller",
  main_engine: "08 Main Engine",
  auxiliary_engines: "09 Auxiliary Engines",
  boilers: "10 Boilers",
  deck_machinery: "11 Deck Machinery",
  cargo_gear: "12 Cargo Gear",
  electrical: "13 Electrical",
  automation: "14 Automation",
  bwts: "15 BWTS",
  class_statutory: "16 Class & Statutory Surveys",
  spares: "17 Spares",
  stores_consumables: "18 Stores & Consumables",
  paints: "19 Paints",
  agency_logistics: "20 Agency & Logistics",
  miscellaneous: "21 Miscellaneous",
  contingency: "22 Contingency",
  docking: "Docking & berth",
  general_services: "General services",
  utilities: "Utilities & connections",
  hull_prep: "Hull preparation",
  hull_paint: "Hull coating",
  steel: "Steel & structure",
  machinery: "Machinery",
  other: "Miscellaneous",
};
