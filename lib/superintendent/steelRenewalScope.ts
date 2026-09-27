/** Structured scope for steel renewal jobs — stored in DdJob.description. */

export const STEEL_RENEWAL_JOB_TAG = "[steelRenewalScope=1]";

export const STEEL_RENEWAL_LOCATION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Engine Room", label: "Engine Room" },
  { value: "On Main Deck", label: "On Main Deck" },
  { value: "Cargo Tank", label: "Cargo Tank" },
  { value: "Ballast Tank", label: "Ballast Tank" },
  { value: "DB Tank", label: "DB Tank" },
  { value: "Fuel Tanks", label: "Fuel Tanks" },
  { value: "Hull", label: "Hull" },
  { value: "Accommodation", label: "Accommodation" },
  { value: "Cargo Holds", label: "Cargo Holds" },
  { value: "Chain Locker", label: "Chain Locker" },
  { value: "Bottom Plate", label: "Bottom Plate" },
  { value: "BT Room", label: "BT Room" },
] as const;

export type SteelRenewalLine = {
  id: string;
  location: string;
  quantityKg: number | null;
};

export type SteelRenewalScope = {
  lines: SteelRenewalLine[];
  notes: string;
};

function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptySteelRenewalLine(): SteelRenewalLine {
  return { id: newLineId(), location: "", quantityKg: null };
}

export function isSteelRenewalJob(job: {
  category?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  if (job.category === "steel") return true;
  if (job.description?.includes(STEEL_RENEWAL_JOB_TAG)) return true;
  return /steel\s*renewal/i.test(job.title ?? "");
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseSteelRenewalScope(description: string | null | undefined): SteelRenewalScope {
  const empty: SteelRenewalScope = { lines: [], notes: "" };
  if (!description?.includes(STEEL_RENEWAL_JOB_TAG)) {
    const trimmed = description?.trim() ?? "";
    return trimmed ? { lines: [], notes: trimmed } : empty;
  }

  const withoutTag = description.replace(STEEL_RENEWAL_JOB_TAG, "").trimStart();
  const parts = withoutTag.split("\n---\n");
  const jsonPart = parts[0]?.trim() ?? "";
  const notes = parts.slice(1).join("\n---\n").trim();

  if (!jsonPart.startsWith("{")) {
    return { lines: [], notes: description.replace(STEEL_RENEWAL_JOB_TAG, "").trim() };
  }

  try {
    const parsed = JSON.parse(jsonPart) as { lines?: unknown[] };
    const lines: SteelRenewalLine[] = [];
    if (Array.isArray(parsed.lines)) {
      for (const item of parsed.lines) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const row = item as Record<string, unknown>;
        const location = row.location == null ? "" : String(row.location);
        const quantityKg = parseOptionalNumber(row.quantityKg);
        if (!location.trim() && quantityKg == null) continue;
        lines.push({
          id: String(row.id ?? "").trim() || newLineId(),
          location,
          quantityKg,
        });
      }
    }
    return { lines, notes };
  } catch {
    return { lines: [], notes: jsonPart };
  }
}

export function serializeSteelRenewalScope(scope: SteelRenewalScope): string {
  const payload = {
    lines: scope.lines.map((line) => ({
      id: line.id,
      location: line.location,
      quantityKg: line.quantityKg,
    })),
  };
  const json = JSON.stringify(payload);
  const notes = scope.notes.trim();
  if (!notes) return `${STEEL_RENEWAL_JOB_TAG}\n${json}`;
  return `${STEEL_RENEWAL_JOB_TAG}\n${json}\n---\n${notes}`;
}

export function steelRenewalTotalKg(lines: SteelRenewalLine[]): number {
  return lines.reduce((sum, line) => sum + (line.quantityKg ?? 0), 0);
}

export function formatSteelRenewalSummary(scope: SteelRenewalScope): string {
  const filled = scope.lines.filter((l) => l.location.trim() && l.quantityKg != null);
  if (filled.length === 0) return "Steel renewal — quantities by location not entered yet.";
  const total = steelRenewalTotalKg(filled);
  const bits = filled.map((l) => `${l.location.trim()}: ${l.quantityKg} kg`);
  return `Steel renewal scope (${total} kg total): ${bits.join("; ")}`;
}

export function validateSteelRenewalScope(scope: SteelRenewalScope): string | null {
  const filled = scope.lines.filter((l) => l.location.trim() || l.quantityKg != null);
  if (filled.length === 0) {
    return "Add at least one steel renewal line with location and quantity (kg).";
  }
  for (const line of filled) {
    if (!line.location.trim()) {
      return "Each steel renewal line needs a location.";
    }
    if (line.quantityKg == null) {
      return `Enter quantity (kg) for ${line.location.trim()}.`;
    }
    if (line.quantityKg < 0) {
      return `Quantity for ${line.location.trim()} cannot be negative.`;
    }
  }
  return null;
}
