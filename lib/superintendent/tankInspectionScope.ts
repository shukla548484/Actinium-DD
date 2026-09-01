/** Structured scope for tank inspection jobs — stored in DdJob.description. */

import {
  TANK_FAMILY_DEFS,
  TANK_JOB_OPTIONS,
  type TankFamilyId,
} from "@/lib/superintendent/tankCondition";

export const TANK_INSPECTION_JOB_TAG = "[tankInspectionScope=1]";

export const TANK_INSPECTION_FAMILY_OPTIONS: readonly { value: TankFamilyId; label: string }[] =
  TANK_FAMILY_DEFS.map((f) => ({ value: f.id, label: f.defaultLabel }));

export const TANK_INSPECTION_LOCATION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Fore peak WBT", label: "Fore peak WBT" },
  { value: "Aft peak WBT", label: "Aft peak WBT" },
  { value: "No. 1 WBT P", label: "No. 1 WBT P" },
  { value: "No. 1 WBT S", label: "No. 1 WBT S" },
  { value: "No. 2 WBT P", label: "No. 2 WBT P" },
  { value: "No. 2 WBT S", label: "No. 2 WBT S" },
  { value: "Double-bottom tank", label: "Double-bottom tank" },
  { value: "Heeling tank", label: "Heeling tank" },
  { value: "Cargo tank", label: "Cargo tank" },
  { value: "Slop tank", label: "Slop tank" },
  { value: "Cargo hold", label: "Cargo hold" },
  { value: "FO settling tank", label: "FO settling tank" },
  { value: "DO service tank", label: "DO service tank" },
  { value: "M/E LO sump tank", label: "M/E LO sump tank" },
  { value: "Fresh water tank", label: "Fresh water tank" },
  { value: "Lubricating oil tank", label: "Lubricating oil tank" },
  { value: "Void space", label: "Void space" },
  { value: "Cofferdam", label: "Cofferdam" },
  { value: "Chain locker", label: "Chain locker" },
] as const;

const ALLOWED_INSPECTION_TYPES = new Set<string>(TANK_JOB_OPTIONS.map((o) => o.value));

export type TankInspectionLine = {
  id: string;
  tankFamily: TankFamilyId | "";
  location: string;
  inspectionTypes: string[];
  coatingRenewal: boolean;
  coatingPercent: number | null;
  cap1Required: boolean;
  cap2Required: boolean;
  capCertificationRequired: boolean;
  classRequirement: string;
  classAttendance: boolean;
  gasFreeRequired: boolean;
  conditionNotes: string;
};

export type TankInspectionScope = {
  lines: TankInspectionLine[];
  notes: string;
};

function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ti-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyTankInspectionLine(): TankInspectionLine {
  return {
    id: newLineId(),
    tankFamily: "",
    location: "",
    inspectionTypes: ["inspection"],
    coatingRenewal: false,
    coatingPercent: null,
    cap1Required: false,
    cap2Required: false,
    capCertificationRequired: false,
    classRequirement: "",
    classAttendance: false,
    gasFreeRequired: true,
    conditionNotes: "",
  };
}

export function isTankInspectionJob(job: {
  category?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  if (job.description?.includes(TANK_INSPECTION_JOB_TAG)) return true;
  if (job.category === "tanks" && /tank\s*(spot\s*)?inspect/i.test(job.title ?? "")) return true;
  return false;
}

function parseBool(value: unknown): boolean {
  return value === true || value === "true";
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTankFamily(value: unknown): TankFamilyId | "" {
  const s = value == null ? "" : String(value);
  return TANK_FAMILY_DEFS.some((f) => f.id === s) ? (s as TankFamilyId) : "";
}

function parseInspectionTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && ALLOWED_INSPECTION_TYPES.has(v));
}

function familyLabel(id: TankFamilyId | ""): string {
  if (!id) return "";
  return TANK_FAMILY_DEFS.find((f) => f.id === id)?.defaultLabel ?? id;
}

function inspectionTypeLabels(types: string[]): string {
  return types
    .map((t) => TANK_JOB_OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(", ");
}

export function parseTankInspectionScope(description: string | null | undefined): TankInspectionScope {
  const empty: TankInspectionScope = { lines: [], notes: "" };
  if (!description?.includes(TANK_INSPECTION_JOB_TAG)) {
    const trimmed = description?.trim() ?? "";
    return trimmed ? { lines: [], notes: trimmed } : empty;
  }

  const withoutTag = description.replace(TANK_INSPECTION_JOB_TAG, "").trimStart();
  const parts = withoutTag.split("\n---\n");
  const jsonPart = parts[0]?.trim() ?? "";
  const notes = parts.slice(1).join("\n---\n").trim();

  if (!jsonPart.startsWith("{")) {
    return { lines: [], notes: description.replace(TANK_INSPECTION_JOB_TAG, "").trim() };
  }

  try {
    const parsed = JSON.parse(jsonPart) as { lines?: unknown[] };
    const lines: TankInspectionLine[] = [];
    if (Array.isArray(parsed.lines)) {
      for (const item of parsed.lines) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const row = item as Record<string, unknown>;
        const location = row.location == null ? "" : String(row.location);
        const inspectionTypes = parseInspectionTypes(row.inspectionTypes);
        const hasData =
          location.trim() ||
          inspectionTypes.length > 0 ||
          parseBool(row.coatingRenewal) ||
          parseBool(row.cap1Required) ||
          parseBool(row.cap2Required) ||
          parseBool(row.capCertificationRequired) ||
          String(row.classRequirement ?? "").trim() ||
          String(row.conditionNotes ?? "").trim();
        if (!hasData) continue;
        lines.push({
          id: String(row.id ?? "").trim() || newLineId(),
          tankFamily: parseTankFamily(row.tankFamily),
          location,
          inspectionTypes: inspectionTypes.length ? inspectionTypes : ["inspection"],
          coatingRenewal: parseBool(row.coatingRenewal),
          coatingPercent: parseOptionalNumber(row.coatingPercent),
          cap1Required: parseBool(row.cap1Required),
          cap2Required: parseBool(row.cap2Required),
          capCertificationRequired: parseBool(row.capCertificationRequired),
          classRequirement: row.classRequirement == null ? "" : String(row.classRequirement).trim(),
          classAttendance: parseBool(row.classAttendance),
          gasFreeRequired: row.gasFreeRequired === undefined ? true : parseBool(row.gasFreeRequired),
          conditionNotes: row.conditionNotes == null ? "" : String(row.conditionNotes).trim(),
        });
      }
    }
    return { lines, notes };
  } catch {
    return { lines: [], notes: jsonPart };
  }
}

export function serializeTankInspectionScope(scope: TankInspectionScope): string {
  const payload = {
    lines: scope.lines.map((line) => ({
      id: line.id,
      tankFamily: line.tankFamily || null,
      location: line.location,
      inspectionTypes: line.inspectionTypes,
      coatingRenewal: line.coatingRenewal,
      coatingPercent: line.coatingPercent,
      cap1Required: line.cap1Required,
      cap2Required: line.cap2Required,
      capCertificationRequired: line.capCertificationRequired,
      classRequirement: line.classRequirement.trim() || null,
      classAttendance: line.classAttendance,
      gasFreeRequired: line.gasFreeRequired,
      conditionNotes: line.conditionNotes.trim() || null,
    })),
  };
  const json = JSON.stringify(payload);
  const notes = scope.notes.trim();
  if (!notes) return `${TANK_INSPECTION_JOB_TAG}\n${json}`;
  return `${TANK_INSPECTION_JOB_TAG}\n${json}\n---\n${notes}`;
}

function requirementBits(line: TankInspectionLine): string[] {
  const bits: string[] = [];
  if (line.inspectionTypes.length) bits.push(inspectionTypeLabels(line.inspectionTypes));
  if (line.coatingRenewal && line.coatingPercent != null) {
    bits.push(`Coating ${line.coatingPercent}%`);
  }
  if (line.cap1Required) bits.push("CAP 1");
  if (line.cap2Required) bits.push("CAP 2");
  if (line.capCertificationRequired) bits.push("CAP cert");
  if (line.classRequirement) bits.push(`Class: ${line.classRequirement}`);
  if (line.classAttendance) bits.push("Class attendance");
  if (line.gasFreeRequired) bits.push("Gas free");
  return bits;
}

export function formatTankInspectionSummary(scope: TankInspectionScope): string {
  const filled = scope.lines.filter((l) => l.location.trim());
  if (filled.length === 0) {
    return scope.notes.trim() || "Tank inspection — locations and scope not entered yet.";
  }
  const bits = filled.map((l) => {
    const fam = familyLabel(l.tankFamily);
    const prefix = fam ? `${fam} — ${l.location.trim()}` : l.location.trim();
    const req = requirementBits(l);
    return req.length ? `${prefix} (${req.join("; ")})` : prefix;
  });
  return `Tank inspection: ${bits.join(" · ")}`;
}

export function validateTankInspectionScope(scope: TankInspectionScope): string | null {
  const filled = scope.lines.filter(
    (l) =>
      l.location.trim() ||
      l.inspectionTypes.length > 0 ||
      l.coatingRenewal ||
      l.cap1Required ||
      l.cap2Required ||
      l.capCertificationRequired ||
      l.classRequirement.trim() ||
      l.conditionNotes.trim(),
  );
  if (filled.length === 0) {
    return "Add at least one tank with location and inspection scope.";
  }
  for (const line of filled) {
    if (!line.location.trim()) {
      return "Each tank line needs a location / tank name.";
    }
    if (
      line.inspectionTypes.length === 0 &&
      !line.cap1Required &&
      !line.cap2Required &&
      !line.capCertificationRequired &&
      !line.classRequirement.trim()
    ) {
      return `${line.location.trim()}: select inspection work or CAP / class requirements.`;
    }
    if (line.coatingRenewal) {
      if (line.coatingPercent == null) {
        return `${line.location.trim()}: enter coating renewal area (%).`;
      }
      if (line.coatingPercent < 0 || line.coatingPercent > 100) {
        return `${line.location.trim()}: coating area % must be between 0 and 100.`;
      }
    }
  }
  return null;
}
