import { HULL_ZONES } from "@/lib/hull/constants";
import type { CalcParams, SpecBucket, SpecLine } from "@/lib/tender/types";
import {
  hullPaintTranslation,
  hullPrepTranslation,
  lookupSpecTranslation,
} from "@/lib/tender/defaultSpecTranslations";
import { nanoid } from "nanoid";

interface TemplateLine {
  bucket: SpecBucket;
  lineCode: string;
  description: string;
  descriptionZh?: string;
  descriptionJa?: string;
  unit: string;
  defaultQty?: number;
  scopeDays?: number;
  scopeAreaM2?: number | null;
  scopeNotes?: string;
  referenceUnitRate?: number;
  maxDiscountPct?: number;
  allowDiscount?: boolean;
  calcRule: SpecLine["calcRule"];
  calcParams?: CalcParams;
  serviceDefId?: string;
  isOptional?: boolean;
}

function withTranslations(line: Omit<TemplateLine, "descriptionZh" | "descriptionJa">): TemplateLine {
  const tr = lookupSpecTranslation(line.lineCode);
  return {
    ...line,
    descriptionZh: tr?.zh,
    descriptionJa: tr?.ja,
  };
}

const CORE_TEMPLATE: TemplateLine[] = [
  withTranslations({
    bucket: "docking_cost",
    lineCode: "DD-001",
    description: "Dry dock hire / dock rent",
    unit: "USD/day",
    scopeNotes: "Owner scope: dry-dock period only. Yard to quote unit rate per day; days are fixed by owner.",
    calcRule: "per_day",
    calcParams: { daysField: "dry_dock_days" },
  }),
  withTranslations({
    bucket: "docking_cost",
    lineCode: "DD-002",
    description: "Wharfage / berth during repair",
    unit: "USD/day",
    calcRule: "per_day",
    calcParams: { daysField: "shipyard_days" },
    isOptional: true,
  }),
  withTranslations({
    bucket: "docking_cost",
    lineCode: "DD-003",
    description: "Docking and undocking (first day dues)",
    unit: "Lump sum",
    calcRule: "lump_sum",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-001",
    description: "Fireman watch",
    unit: "USD/person/shift",
    calcRule: "watch",
    calcParams: { daysField: "total_service", shiftHours: 8, serviceDefId: "fireman-watch" },
    serviceDefId: "fireman-watch",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-002",
    description: "Security patrol",
    unit: "USD/person/shift",
    calcRule: "watch",
    calcParams: { daysField: "total_service", shiftHours: 8, serviceDefId: "security-patrol" },
    serviceDefId: "security-patrol",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-003",
    description: "Temporary ventilation",
    unit: "USD/unit/day",
    defaultQty: 2,
    calcRule: "unit_qty_days",
    calcParams: { daysField: "total_service", defaultQty: 2, serviceDefId: "temporary-ventilation" },
    serviceDefId: "temporary-ventilation",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-004",
    description: "Temporary lighting",
    unit: "USD/unit/day",
    defaultQty: 4,
    calcRule: "unit_qty_days",
    calcParams: { daysField: "total_service", defaultQty: 4, serviceDefId: "temporary-lighting" },
    serviceDefId: "temporary-lighting",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-001",
    description: "Cooling water line (daily charge)",
    unit: "USD/connection/day",
    defaultQty: 5,
    scopeNotes: "5 connections × CPR days. Daily rate per connection; connections fixed by owner.",
    calcRule: "connection_daily",
    calcParams: {
      daysField: "connection_days",
      defaultConnections: 5,
      serviceDefId: "cooling-water",
    },
    serviceDefId: "cooling-water",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-002",
    description: "Cooling water connect / disconnect (×2)",
    unit: "USD/connection",
    defaultQty: 5,
    scopeNotes: "Hookup fee ×2 (connect + disconnect) × 5 connections. Multiplier fixed by owner.",
    calcRule: "connect_disconnect",
    calcParams: {
      defaultConnections: 5,
      connectDisconnectMultiplier: 2,
      serviceDefId: "cooling-water",
    },
    serviceDefId: "cooling-water",
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-003",
    description: "Shore power / electrical (daily)",
    unit: "USD/connection/day",
    defaultQty: 2,
    calcRule: "connection_daily",
    calcParams: {
      daysField: "connection_days",
      defaultConnections: 2,
      serviceDefId: "shore-power",
    },
    serviceDefId: "shore-power",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-004",
    description: "Shore power connect / disconnect (×2)",
    unit: "USD/connection",
    defaultQty: 2,
    calcRule: "connect_disconnect",
    calcParams: {
      defaultConnections: 2,
      connectDisconnectMultiplier: 2,
      serviceDefId: "shore-power",
    },
    serviceDefId: "shore-power",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-005",
    description: "Compressed air (daily)",
    unit: "USD/connection/day",
    defaultQty: 2,
    calcRule: "connection_daily",
    calcParams: {
      daysField: "connection_days",
      defaultConnections: 2,
      serviceDefId: "compressed-air",
    },
    serviceDefId: "compressed-air",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-006",
    description: "Fresh water line (daily)",
    unit: "USD/connection/day",
    defaultQty: 2,
    scopeNotes: "2 fresh water connections for CPR stay. Owner-defined connections and days.",
    calcRule: "connection_daily",
    calcParams: {
      daysField: "connection_days",
      defaultConnections: 2,
      serviceDefId: "fresh-water",
    },
    serviceDefId: "fresh-water",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "UT-007",
    description: "Fresh water connect / disconnect (×2)",
    unit: "USD/connection",
    defaultQty: 2,
    scopeNotes: "Connect + disconnect × 2 connections.",
    calcRule: "connect_disconnect",
    calcParams: {
      defaultConnections: 2,
      connectDisconnectMultiplier: 2,
      serviceDefId: "fresh-water",
    },
    serviceDefId: "fresh-water",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-005",
    description: "Exhaust fan / temporary exhaust",
    unit: "USD/unit/day",
    defaultQty: 2,
    scopeNotes: "2 portable exhaust fans for tank/hot work. Units and service days fixed by owner.",
    calcRule: "unit_qty_days",
    calcParams: { daysField: "total_service", defaultQty: 2, serviceDefId: "exhaust-fan" },
    serviceDefId: "exhaust-fan",
    isOptional: true,
  }),
  withTranslations({
    bucket: "steel_renewal",
    lineCode: "ST-001",
    description: "Steel renewal / insert plates",
    unit: "USD/kg",
    defaultQty: 500,
    scopeNotes: "Allowance 500 kg steel renewal per owner NDT report. Yard quotes unit rate only.",
    calcRule: "unit_qty",
    isOptional: true,
  }),
  withTranslations({
    bucket: "steel_renewal",
    lineCode: "ST-002",
    description: "Staging / access for hull and cargo holds",
    unit: "Lump sum",
    scopeNotes: "Full staging as per owner scope drawing. Lump sum quote.",
    calcRule: "lump_sum",
    isOptional: true,
  }),
  withTranslations({
    bucket: "main_engine",
    lineCode: "MC-001",
    description: "Main engine / auxiliary machinery works (allowance)",
    unit: "Lump sum",
    scopeNotes: "Owner-defined machinery scope — yard to quote lump sum per attached job list.",
    calcRule: "lump_sum",
    isOptional: true,
  }),
  withTranslations({
    bucket: "general_service_cost",
    lineCode: "GS-006",
    description: "General yard services & overhead",
    unit: "Lump sum",
    scopeNotes: "Yard overhead, cleaning, waste disposal per owner spec.",
    calcRule: "lump_sum",
  }),
];

function hullPrepLines(): TemplateLine[] {
  const zones = HULL_ZONES.filter((z) => z.id !== "full-hull");
  return zones.flatMap((zone, zi) => {
    const prepTr = hullPrepTranslation(zone.name);
    const paintTr = hullPaintTranslation(zone.name);
    return [
      {
        bucket: "hull_cleaning_painting" as SpecBucket,
        lineCode: `HP-${String(zi + 1).padStart(2, "0")}`,
        description: `${zone.name} — HP wash / preparation`,
        descriptionZh: prepTr.zh,
        descriptionJa: prepTr.ja,
        unit: "USD/m²",
        scopeAreaM2: null,
        scopeNotes: `Owner to enter m² for ${zone.name}. Yard quotes rate per m² only.`,
        calcRule: "per_m2" as const,
        calcParams: { serviceDefId: `hull-${zone.id}-prep` },
        isOptional: true,
      },
      {
        bucket: "hull_cleaning_painting" as SpecBucket,
        lineCode: `PC-${String(zi + 1).padStart(2, "0")}`,
        description: `${zone.name} — Coating application`,
        descriptionZh: paintTr.zh,
        descriptionJa: paintTr.ja,
        unit: "USD/m²",
        scopeAreaM2: null,
        scopeNotes: `Owner to enter coating area m² for ${zone.name}. Product spec per owner coating spec.`,
        calcRule: "per_m2" as const,
        calcParams: { serviceDefId: `hull-${zone.id}-paint` },
        isOptional: true,
      },
    ];
  });
}

export function buildDefaultSpecLines(projectId: string): Omit<SpecLine, "id">[] {
  const template = [...CORE_TEMPLATE, ...hullPrepLines()];
  return template.map((t, i) => ({
    projectId,
    bucket: t.bucket,
    sortOrder: i,
    lineCode: t.lineCode,
    description: t.description,
    descriptions: {
      en: t.description,
      zh: t.descriptionZh ?? null,
      ja: t.descriptionJa ?? null,
    },
    unit: t.unit,
    defaultQty: t.defaultQty ?? null,
    scopeDays: t.scopeDays ?? null,
    scopeAreaM2: t.scopeAreaM2 ?? null,
    scopeNotes: t.scopeNotes ?? null,
    ownerLocked: true,
    allowDiscount: t.allowDiscount ?? true,
    maxDiscountPct: t.maxDiscountPct ?? null,
    referenceUnitRate: t.referenceUnitRate ?? null,
    calcRule: t.calcRule,
    calcParams: t.calcParams ?? {},
    serviceDefId: t.serviceDefId ?? null,
    isOptional: t.isOptional ?? false,
  }));
}

export function createSpecLineFromTemplate(
  projectId: string,
  template: Omit<SpecLine, "id">,
): SpecLine {
  return { id: nanoid(), ...template };
}
