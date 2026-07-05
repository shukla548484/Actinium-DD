/**
 * Actinium-SM Engineering Master Code Standard (Version 1.0)
 *
 * Fixed 4-character entity codes for PostgreSQL, Prisma, APIs, imports, QR, and integrations.
 * Canonical format: `<EntityCode>-<System>-<Subsystem>-<RunningNumber>`
 * Extended rows may append sub-segments (e.g. MEAS-ME-CYU-001-001).
 */

export const MASTER_CODE_STANDARD_VERSION = "1.0";

/** Core engineering repository entity codes. */
export const MASTER_ENTITY_CODES = {
  EQPM: "EQPM",
  COMP: "COMP",
  SUBC: "SUBC",
  JOBS: "JOBS",
  TMPL: "TMPL",
  MEAS: "MEAS",
  INSP: "INSP",
  SCOP: "SCOP",
  SPAR: "SPAR",
  CONS: "CONS",
  TOOL: "TOOL",
  MATL: "MATL",
  RISK: "RISK",
  RFQM: "RFQM",
  BDGT: "BDGT",
  WORK: "WORK",
} as const;

/** Extended master-data entity codes (fleet, procurement, governance). */
export const EXTENDED_ENTITY_CODES = {
  VSSL: "VSSL",
  FLET: "FLET",
  COMPY: "COMPY",
  VEND: "VEND",
  MAKE: "MAKE",
  CLAS: "CLAS",
  FLAG: "FLAG",
  OWNR: "OWNR",
  YARD: "YARD",
  DEPT: "DEPT",
  WSHP: "WSHP",
  PROJ: "PROJ",
  MILE: "MILE",
  OBSV: "OBSV",
  DFCT: "DFCT",
  ATCH: "ATCH",
  IMAG: "IMAG",
  DOCS: "DOCS",
  CERT: "CERT",
  DRWG: "DRWG",
  MANL: "MANL",
  RPRT: "RPRT",
  PRQS: "PRQS",
  PORD: "PORD",
  QUOT: "QUOT",
  INVC: "INVC",
  COST: "COST",
  BDIT: "BDIT",
  CURR: "CURR",
  UOMS: "UOMS",
  RHRS: "RHRS",
  INTV: "INTV",
  SURV: "SURV",
  CHKL: "CHKL",
  AUDT: "AUDT",
  NOTF: "NOTF",
  APRV: "APRV",
  USER: "USER",
  ROLE: "ROLE",
  PERM: "PERM",
  APIS: "APIS",
  SQLT: "SQLT",
  PRSM: "PRSM",
} as const;

export type MasterEntityCode =
  | (typeof MASTER_ENTITY_CODES)[keyof typeof MASTER_ENTITY_CODES]
  | (typeof EXTENDED_ENTITY_CODES)[keyof typeof EXTENDED_ENTITY_CODES];

/** Legacy 2–3 letter prefixes → canonical 4-letter entity codes. */
export const LEGACY_ENTITY_PREFIX_MAP: Record<string, MasterEntityCode> = {
  JOB: MASTER_ENTITY_CODES.JOBS,
  JOBS: MASTER_ENTITY_CODES.JOBS,
  TMP: MASTER_ENTITY_CODES.TMPL,
  TMPL: MASTER_ENTITY_CODES.TMPL,
  MEA: MASTER_ENTITY_CODES.MEAS,
  MEAS: MASTER_ENTITY_CODES.MEAS,
  INS: MASTER_ENTITY_CODES.INSP,
  INSP: MASTER_ENTITY_CODES.INSP,
  SOW: MASTER_ENTITY_CODES.SCOP,
  SCOP: MASTER_ENTITY_CODES.SCOP,
  SPR: MASTER_ENTITY_CODES.SPAR,
  SPAR: MASTER_ENTITY_CODES.SPAR,
  RFQ: MASTER_ENTITY_CODES.RFQM,
  RFQM: MASTER_ENTITY_CODES.RFQM,
  BUD: MASTER_ENTITY_CODES.BDGT,
  BDGT: MASTER_ENTITY_CODES.BDGT,
  WF: MASTER_ENTITY_CODES.WORK,
  WORK: MASTER_ENTITY_CODES.WORK,
  EQ: MASTER_ENTITY_CODES.EQPM,
  EQPM: MASTER_ENTITY_CODES.EQPM,
  CMP: MASTER_ENTITY_CODES.COMP,
  COM: MASTER_ENTITY_CODES.COMP,
  COMP: MASTER_ENTITY_CODES.COMP,
  SUB: MASTER_ENTITY_CODES.SUBC,
  SUBC: MASTER_ENTITY_CODES.SUBC,
  CON: MASTER_ENTITY_CODES.CONS,
  CONS: MASTER_ENTITY_CODES.CONS,
  TOL: MASTER_ENTITY_CODES.TOOL,
  TOOL: MASTER_ENTITY_CODES.TOOL,
  MAT: MASTER_ENTITY_CODES.MATL,
  MATL: MASTER_ENTITY_CODES.MATL,
  RSK: MASTER_ENTITY_CODES.RISK,
  RISK: MASTER_ENTITY_CODES.RISK,
  ATT: EXTENDED_ENTITY_CODES.ATCH,
  ATCH: EXTENDED_ENTITY_CODES.ATCH,
};

/** Main-engine subsystem codes used in V2.0.1+ sprint libraries. */
export const MASTER_EQUIPMENT_SYSTEM_CODES = {
  ME: "Main Engine",
  CYU: "Cylinder Unit",
  FIS: "Fuel Injection System",
  EVS: "Exhaust Valve System",
  TCH: "Turbocharger System",
  CRK: "Crankshaft",
  CRH: "Crosshead",
  STA: "Starting Air",
  LUB: "Lubrication",
  CLG: "Cooling",
  CTL: "Control System",
} as const;

export type MasterEquipmentSystemCode = keyof typeof MASTER_EQUIPMENT_SYSTEM_CODES;

export type ParsedMasterCode = {
  raw: string;
  entity: MasterEntityCode | string;
  segments: string[];
  /** True when the entity segment uses the v1.0 4-letter code. */
  isCanonical: boolean;
};

function padSeq(seq: number, width = 4): string {
  return String(seq).padStart(width, "0");
}

/** Replace legacy entity prefix with canonical 4-letter code; preserve tail segments. */
export function normalizeMasterId(id: string, entityOverride?: MasterEntityCode): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split("-").filter(Boolean);
  if (parts.length === 0) return trimmed;

  const legacy = parts[0]!.toUpperCase();
  const canonical = entityOverride ?? LEGACY_ENTITY_PREFIX_MAP[legacy];
  if (!canonical) return trimmed;

  parts[0] = canonical;
  return parts.join("-");
}

/** Parse a master code into entity + path segments. */
export function parseMasterCode(id: string): ParsedMasterCode | null {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("-").filter(Boolean);
  if (parts.length < 2) return null;

  const entityRaw = parts[0]!.toUpperCase();
  const canonical = LEGACY_ENTITY_PREFIX_MAP[entityRaw] ?? entityRaw;

  return {
    raw: trimmed,
    entity: canonical,
    segments: parts.slice(1),
    isCanonical: entityRaw === canonical && entityRaw.length === 4,
  };
}

export function isCanonicalMasterId(id: string): boolean {
  const parsed = parseMasterCode(id);
  return parsed?.isCanonical ?? false;
}

/** Build `<Entity>-<System>-<Subsystem>-<Seq>` (4-part canonical ID). */
export function buildMasterCode(
  entity: MasterEntityCode,
  system: string,
  subsystem: string,
  seq: number,
  seqWidth = 4,
): string {
  return `${entity}-${system.toUpperCase()}-${subsystem.toUpperCase()}-${padSeq(seq, seqWidth)}`;
}

export function buildEquipmentId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.EQPM, system, subsystem, seq);
}

export function buildComponentId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.COMP, system, subsystem, seq);
}

export function buildSubcomponentId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.SUBC, system, subsystem, seq);
}

export function buildStandardJobId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.JOBS, system, subsystem, seq);
}

export function buildDynamicTemplateId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.TMPL, system, subsystem, seq);
}

export function buildMeasurementSetId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.MEAS, system, subsystem, seq);
}

export function buildInspectionSetId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.INSP, system, subsystem, seq);
}

export function buildScopeOfWorkId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.SCOP, system, subsystem, seq);
}

export function buildSpareMapId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.SPAR, system, subsystem, seq);
}

export function buildWorkflowId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.WORK, system, subsystem, seq);
}

export function buildRfqMappingId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.RFQM, system, subsystem, seq);
}

export function buildBudgetMappingId(system: string, subsystem: string, seq: number): string {
  return buildMasterCode(MASTER_ENTITY_CODES.BDGT, system, subsystem, seq);
}

/** Derive linked master IDs from a template ID (canonical or legacy). */
export function measurementSetIdForTemplateId(templateId: string): string {
  const normalized = normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL);
  return normalized.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.MEAS}-`);
}

export function inspectionSetIdForTemplateId(templateId: string): string {
  const normalized = normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL);
  return normalized.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.INSP}-`);
}

export function scopeOfWorkIdForTemplateId(templateId: string): string {
  const normalized = normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL);
  return normalized.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.SCOP}-`);
}

export function workflowIdForTemplateId(templateId: string): string {
  const normalized = normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL);
  return normalized.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.WORK}-`);
}

/** Entity prefix patterns for import validation / admin UI. */
export const MASTER_CODE_ENTITY_CATALOG: {
  code: MasterEntityCode;
  label: string;
  description: string;
  legacyPrefixes: string[];
}[] = [
  { code: MASTER_ENTITY_CODES.EQPM, label: "Equipment", description: "Equipment / Machinery Master", legacyPrefixes: ["EQ"] },
  { code: MASTER_ENTITY_CODES.COMP, label: "Component", description: "Component Master", legacyPrefixes: ["COM"] },
  { code: MASTER_ENTITY_CODES.SUBC, label: "Subcomponent", description: "Subcomponent Master", legacyPrefixes: ["SUB"] },
  { code: MASTER_ENTITY_CODES.JOBS, label: "Standard Job", description: "Standard Job Library", legacyPrefixes: ["JOB"] },
  { code: MASTER_ENTITY_CODES.TMPL, label: "Dynamic Template", description: "Dynamic Template Library", legacyPrefixes: ["TMP"] },
  { code: MASTER_ENTITY_CODES.MEAS, label: "Measurement", description: "Measurement Master", legacyPrefixes: ["MEA"] },
  { code: MASTER_ENTITY_CODES.INSP, label: "Inspection Point", description: "Inspection Point Library", legacyPrefixes: ["INS"] },
  { code: MASTER_ENTITY_CODES.SCOP, label: "Scope of Work", description: "Scope of Work Library", legacyPrefixes: ["SOW", "WF"] },
  { code: MASTER_ENTITY_CODES.SPAR, label: "Spare Part", description: "Spare Parts Master", legacyPrefixes: ["SPR"] },
  { code: MASTER_ENTITY_CODES.CONS, label: "Consumable", description: "Consumables Master", legacyPrefixes: ["CON"] },
  { code: MASTER_ENTITY_CODES.TOOL, label: "Tool", description: "Tool & Equipment Master", legacyPrefixes: ["TOL"] },
  { code: MASTER_ENTITY_CODES.MATL, label: "Material", description: "Materials Master", legacyPrefixes: ["MAT"] },
  { code: MASTER_ENTITY_CODES.RISK, label: "Risk Assessment", description: "Risk Assessment Library", legacyPrefixes: ["RSK"] },
  { code: MASTER_ENTITY_CODES.RFQM, label: "RFQ Mapping", description: "RFQ Mapping Library", legacyPrefixes: ["RFQ"] },
  { code: MASTER_ENTITY_CODES.BDGT, label: "Budget Mapping", description: "Budget Mapping Library", legacyPrefixes: ["BUD"] },
  { code: MASTER_ENTITY_CODES.WORK, label: "Workflow", description: "Workflow Master", legacyPrefixes: ["WF"] },
];
