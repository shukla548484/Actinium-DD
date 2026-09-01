/** Structured scope for thickness measurement (UTM) jobs — stored in DdJob.description. */

export const THICKNESS_MEASUREMENT_JOB_TAG = "[thicknessMeasurementScope=1]";

export const THICKNESS_LOCATION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Flat bottom", label: "Flat bottom" },
  { value: "Vertical bottom", label: "Vertical bottom" },
  { value: "Boot top", label: "Boot top" },
  { value: "Topside", label: "Topside" },
  { value: "Hull — general", label: "Hull — general" },
  { value: "Engine room", label: "Engine room" },
  { value: "Cargo tank", label: "Cargo tank" },
  { value: "Ballast tank", label: "Ballast tank" },
  { value: "DB tank", label: "DB tank" },
  { value: "Fuel tank", label: "Fuel tank" },
  { value: "Cargo holds", label: "Cargo holds" },
  { value: "Accommodation", label: "Accommodation" },
  { value: "Main deck", label: "Main deck" },
  { value: "Fore peak", label: "Fore peak" },
  { value: "Aft peak", label: "Aft peak" },
  { value: "Chain locker", label: "Chain locker" },
  { value: "Sea chest", label: "Sea chest" },
] as const;

export type ThicknessMeasurementLine = {
  id: string;
  location: string;
  cap1Required: boolean;
  cap2Required: boolean;
  classRequirement: string;
};

export type ThicknessMeasurementScope = {
  lines: ThicknessMeasurementLine[];
  notes: string;
};

function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyThicknessMeasurementLine(): ThicknessMeasurementLine {
  return {
    id: newLineId(),
    location: "",
    cap1Required: false,
    cap2Required: false,
    classRequirement: "",
  };
}

export function isThicknessMeasurementJob(job: {
  category?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  if (job.description?.includes(THICKNESS_MEASUREMENT_JOB_TAG)) return true;
  return /thickness\s*measure/i.test(job.title ?? "");
}

function parseBool(value: unknown): boolean {
  return value === true || value === "true";
}

export function parseThicknessMeasurementScope(
  description: string | null | undefined,
): ThicknessMeasurementScope {
  const empty: ThicknessMeasurementScope = { lines: [], notes: "" };
  if (!description?.includes(THICKNESS_MEASUREMENT_JOB_TAG)) {
    const trimmed = description?.trim() ?? "";
    return trimmed ? { lines: [], notes: trimmed } : empty;
  }

  const withoutTag = description.replace(THICKNESS_MEASUREMENT_JOB_TAG, "").trimStart();
  const parts = withoutTag.split("\n---\n");
  const jsonPart = parts[0]?.trim() ?? "";
  const notes = parts.slice(1).join("\n---\n").trim();

  if (!jsonPart.startsWith("{")) {
    return { lines: [], notes: description.replace(THICKNESS_MEASUREMENT_JOB_TAG, "").trim() };
  }

  try {
    const parsed = JSON.parse(jsonPart) as { lines?: unknown[] };
    const lines: ThicknessMeasurementLine[] = [];
    if (Array.isArray(parsed.lines)) {
      for (const item of parsed.lines) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const row = item as Record<string, unknown>;
        const location = row.location == null ? "" : String(row.location);
        const cap1Required = parseBool(row.cap1Required);
        const cap2Required = parseBool(row.cap2Required);
        const classRequirement =
          row.classRequirement == null ? "" : String(row.classRequirement).trim();
        if (!location.trim() && !cap1Required && !cap2Required && !classRequirement) continue;
        lines.push({
          id: String(row.id ?? "").trim() || newLineId(),
          location,
          cap1Required,
          cap2Required,
          classRequirement,
        });
      }
    }
    return { lines, notes };
  } catch {
    return { lines: [], notes: jsonPart };
  }
}

export function serializeThicknessMeasurementScope(scope: ThicknessMeasurementScope): string {
  const payload = {
    lines: scope.lines.map((line) => ({
      id: line.id,
      location: line.location,
      cap1Required: line.cap1Required,
      cap2Required: line.cap2Required,
      classRequirement: line.classRequirement.trim() || null,
    })),
  };
  const json = JSON.stringify(payload);
  const notes = scope.notes.trim();
  if (!notes) return `${THICKNESS_MEASUREMENT_JOB_TAG}\n${json}`;
  return `${THICKNESS_MEASUREMENT_JOB_TAG}\n${json}\n---\n${notes}`;
}

function requirementBits(line: ThicknessMeasurementLine): string[] {
  const bits: string[] = [];
  if (line.cap1Required) bits.push("CAP 1");
  if (line.cap2Required) bits.push("CAP 2");
  if (line.classRequirement.trim()) bits.push(`Class: ${line.classRequirement.trim()}`);
  return bits;
}

export function formatThicknessMeasurementSummary(scope: ThicknessMeasurementScope): string {
  const filled = scope.lines.filter((l) => l.location.trim());
  if (filled.length === 0) {
    return scope.notes.trim() || "Thickness measurement — locations and survey requirements not entered yet.";
  }
  const bits = filled.map((l) => {
    const req = requirementBits(l);
    return req.length
      ? `${l.location.trim()} (${req.join(", ")})`
      : l.location.trim();
  });
  return `UTM scope: ${bits.join("; ")}`;
}

export function validateThicknessMeasurementScope(scope: ThicknessMeasurementScope): string | null {
  const filled = scope.lines.filter(
    (l) =>
      l.location.trim() ||
      l.cap1Required ||
      l.cap2Required ||
      l.classRequirement.trim(),
  );
  if (filled.length === 0) {
    return "Add at least one location with CAP 1, CAP 2, and/or class requirement.";
  }
  for (const line of filled) {
    if (!line.location.trim()) {
      return "Each thickness measurement line needs a location.";
    }
    if (!line.cap1Required && !line.cap2Required && !line.classRequirement.trim()) {
      return `Select CAP 1, CAP 2, or enter a class requirement for ${line.location.trim()}.`;
    }
  }
  return null;
}
