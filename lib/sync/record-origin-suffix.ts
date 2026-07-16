/**
 * Office vs vessel vs teleport (online portal) document identity — prevents number collisions when syncing.
 *
 * - Requisitions: leading prefix `O.` (office), `V.` (ship LAN / local), or `T.` (crew on online server).
 * - Defect codes: trailing suffix `.O` / `.V` / `.T` on `vessel.year.TYPE.seq`.
 * - Daily work reports: trailing `-O` / `-V` / `-T` on `VESSEL-DWR-year-seq`.
 * - Emergency drills: trailing `-O` / `-V` / `-T` on `EDR-year-seq`.
 * - Noon V2: `record_origin` + display `o###` / `v###` / `t###`.
 *
 * Access 6–25 on ship LAN (DEPLOYMENT_ROLE=local) → V.
 * Access 6–25 on online server portal → T (avoids colliding with ship V.* sequence).
 * All other levels on server → O.
 */

import { isLocalDeployment } from "@/lib/vessel-sync/local-access";

export type RecordOriginChannel = "OFFICE" | "VESSEL" | "TELEPORT";

export const OFFICE_ORIGIN_LETTER = "O";
export const VESSEL_ORIGIN_LETTER = "V";
export const TELEPORT_ORIGIN_LETTER = "T";

export type OriginLetter =
  | typeof OFFICE_ORIGIN_LETTER
  | typeof VESSEL_ORIGIN_LETTER
  | typeof TELEPORT_ORIGIN_LETTER;

/** Main app: designation access levels that count as vessel-side crew (6–25). */
export const VESSEL_ORIGIN_ACCESS_LEVEL_MIN = 6;
export const VESSEL_ORIGIN_ACCESS_LEVEL_MAX = 25;

export function isCrewAccessLevel(designationAccessLevel: number | null | undefined): boolean {
  const level = Number(designationAccessLevel ?? 0);
  return (
    level >= VESSEL_ORIGIN_ACCESS_LEVEL_MIN &&
    level <= VESSEL_ORIGIN_ACCESS_LEVEL_MAX
  );
}

export type ResolveRecordOriginOptions = {
  /** Actinium-sm Bearer push from ship LAN — always vessel. */
  isVesselLocalSync?: boolean;
  /** DEPLOYMENT_ROLE=local ship server. Defaults to runtime isLocalDeployment(). */
  isLocal?: boolean;
};

/**
 * Resolve O / V / T channel from access level and deployment context.
 */
export function resolveRecordOrigin(
  designationAccessLevel: number | null | undefined,
  options: ResolveRecordOriginOptions = {}
): RecordOriginChannel {
  if (options.isVesselLocalSync) {
    return "VESSEL";
  }

  const isLocal = options.isLocal ?? isLocalDeployment();

  if (isLocal) {
    return isCrewAccessLevel(designationAccessLevel) ? "VESSEL" : "OFFICE";
  }

  if (isCrewAccessLevel(designationAccessLevel)) {
    return "TELEPORT";
  }

  return "OFFICE";
}

/**
 * @deprecated Prefer {@link resolveRecordOrigin} with explicit deployment options.
 * Uses runtime DEPLOYMENT_ROLE (local → V for crew, server → T for crew).
 */
export function recordOriginFromAccessLevel(
  designationAccessLevel: number | null | undefined,
  options?: ResolveRecordOriginOptions
): RecordOriginChannel {
  return resolveRecordOrigin(designationAccessLevel, options);
}

export function originLetter(origin: RecordOriginChannel): OriginLetter {
  if (origin === "VESSEL") return VESSEL_ORIGIN_LETTER;
  if (origin === "TELEPORT") return TELEPORT_ORIGIN_LETTER;
  return OFFICE_ORIGIN_LETTER;
}

/** Requisition numbers use a leading O./V./T. prefix. */
export function requisitionNumberPrefix(origin: RecordOriginChannel): OriginLetter {
  return originLetter(origin);
}

export function isCrewOriginatedRequisitionNumber(requisitionNumber: string): boolean {
  const num = requisitionNumber.trim().toUpperCase();
  return num.startsWith("V.") || num.startsWith("T.");
}

export function ensureRequisitionNumberOrigin(
  requisitionNumber: string,
  origin: RecordOriginChannel
): string {
  const trimmed = requisitionNumber.trim();
  if (!trimmed) return trimmed;
  const letter = originLetter(origin);
  if (/^[OVT]\./i.test(trimmed)) {
    return `${letter}.${trimmed.slice(2)}`;
  }
  if (/^[OVT]/i.test(trimmed) && trimmed[1] !== ".") {
    return `${letter}.${trimmed.slice(1)}`;
  }
  return `${letter}.${trimmed}`;
}

const DEFECT_SUFFIX_RE = /\.[OVT]$/i;

export function stripDefectCodeOriginSuffix(defectCode: string): string {
  return defectCode.trim().replace(DEFECT_SUFFIX_RE, "");
}

export function appendDefectCodeOriginSuffix(
  defectCode: string,
  origin: RecordOriginChannel
): string {
  const base = stripDefectCodeOriginSuffix(defectCode);
  return `${base}.${originLetter(origin)}`;
}

const DWR_SUFFIX_RE = /-[OVT]$/i;

export function stripDailyWorkReportOriginSuffix(reportNumber: string): string {
  return reportNumber.trim().replace(DWR_SUFFIX_RE, "");
}

export function dailyWorkReportNumberStem(
  vesselCode: string,
  year: number,
  sequence: number
): string {
  return `${vesselCode}-DWR-${year}-${sequence.toString().padStart(4, "0")}`;
}

export function appendDailyWorkReportOriginSuffix(
  reportNumber: string,
  origin: RecordOriginChannel
): string {
  const base = stripDailyWorkReportOriginSuffix(reportNumber);
  return `${base}-${originLetter(origin)}`;
}

const EDRILL_SUFFIX_RE = /-[OVT]$/i;

export function stripEmergencyDrillNumberOriginSuffix(drillNumber: string): string {
  return drillNumber.trim().replace(EDRILL_SUFFIX_RE, "");
}

export function appendEmergencyDrillNumberOriginSuffix(
  drillNumber: string,
  origin: RecordOriginChannel
): string {
  const base = stripEmergencyDrillNumberOriginSuffix(drillNumber);
  return `${base}-${originLetter(origin)}`;
}

export function buildDailyWorkReportNumber(
  vesselCode: string,
  year: number,
  sequence: number,
  origin: RecordOriginChannel
): string {
  return appendDailyWorkReportOriginSuffix(
    dailyWorkReportNumberStem(vesselCode, year, sequence),
    origin
  );
}

export function parseDailyWorkReportSequence(reportNumber: string): number | null {
  const base = stripDailyWorkReportOriginSuffix(reportNumber);
  const match = base.match(/-(\d{4})$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function defectTypeReportSegment(defectType: string): string {
  if (defectType === "OBSERVATION") return "OBS";
  if (defectType === "NON_CONFORMITY") return "NCF";
  if (defectType === "MAJOR_NON_CONFORMITY") return "MNC";
  if (defectType === "TECHNICAL_DEFICIENCY") return "TDF";
  return "DEF";
}
