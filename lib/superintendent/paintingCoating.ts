import { lockedCargoSpaceKind } from "@/lib/superintendent/tankCondition";

/** Nested `values.areas` keys stored on DdInputSubmission.valuesJson for section `painting`. */
export const PAINTING_AREA_IDS = [
  "hull",
  "ballast_tanks",
  "cargo_holds",
  "cargo_tanks",
  "sea_chest",
  "chain_locker",
  "main_deck",
] as const;

export type PaintingAreaId = (typeof PAINTING_AREA_IDS)[number];

export const PAINTING_HULL_ZONE_FIELDS = [
  { key: "flatBottomArea", label: "Flat bottom" },
  { key: "verticalBottomArea", label: "Vertical bottom" },
  { key: "bootTopArea", label: "Boot top" },
  { key: "topsideArea", label: "Topside" },
] as const;

export type PaintingHullZoneKey = (typeof PAINTING_HULL_ZONE_FIELDS)[number]["key"];

/** Surface prep / treatment types — % is share of that zone’s area assigned to the yard. */
export const HULL_TREATMENT_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "High Pressure Wash", label: "High Pressure Wash" },
  { value: "Freshwater Wash", label: "Freshwater Wash" },
  { value: "Hull Cleaning", label: "Hull Cleaning" },
  { value: "Hand Tool Cleaning", label: "Hand Tool Cleaning" },
  { value: "Power Tool Cleaning", label: "Power Tool Cleaning" },
  { value: "Manual Scraping", label: "Manual Scraping" },
  { value: "Spot Blasting", label: "Spot Blasting" },
  { value: "Full Blasting", label: "Full Blasting" },
  { value: "Hydroblasting", label: "Hydroblasting" },
  { value: "SA 1 (Brush-off)", label: "SA 1 (Brush-off)" },
  { value: "SA 1.5", label: "SA 1.5" },
  { value: "SA 2 (Commercial)", label: "SA 2 (Commercial)" },
  { value: "SA 2½ (Near-white)", label: "SA 2½ (Near-white)" },
  { value: "SA 3 (White Metal)", label: "SA 3 (White Metal)" },
  { value: "Air Drying", label: "Air Drying" },
] as const;

export type HullTreatmentAssignment = {
  id: string;
  treatmentType: string;
  /** % of this hull zone’s area for the yard (0–100). */
  percentYard: number | null;
};

/** Per-zone hull scope: treatments + coat / paint scheme. */
export type HullZoneScope = {
  treatments: HullTreatmentAssignment[];
  primerCoats: number | null;
  finishCoats: number | null;
  /** Free-text paint system / product for this zone (spaces preserved while typing). */
  paintSystem: string;
};

export type HullZonesMap = Record<PaintingHullZoneKey, HullZoneScope>;

export type PaintingAreaDef = {
  id: PaintingAreaId;
  label: string;
  hint: string;
  /** Hull keeps zone m² at top-level keys for hull-paint compare. */
  hasZoneAreas: boolean;
  hasAreaM2: boolean;
};

export const PAINTING_AREA_DEFS: readonly PaintingAreaDef[] = [
  {
    id: "hull",
    label: "Hull",
    hint: "Flat bottom, vertical bottom, boot top, and topside — each zone has its own treatments, primer/finish coats, and paint system.",
    hasZoneAreas: true,
    hasAreaM2: false,
  },
  {
    id: "ballast_tanks",
    label: "Ballast tanks",
    hint: "Peak tanks, wing / double-bottom WBTs, heeling tanks.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
  {
    id: "cargo_holds",
    label: "Cargo holds",
    hint: "Dry cargo / bulk holds. Skip if this vessel uses cargo tanks instead.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
  {
    id: "cargo_tanks",
    label: "Cargo tanks",
    hint: "Tanker cargo / slop tanks. Skip if this vessel uses cargo holds instead.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
  {
    id: "sea_chest",
    label: "Sea chest(s)",
    hint: "Sea chests and gratings, if painting this docking.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
  {
    id: "chain_locker",
    label: "Chain locker",
    hint: "Chain locker coating, if in yard scope.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
  {
    id: "main_deck",
    label: "Main deck",
    hint: "Main deck coating, if in yard scope.",
    hasZoneAreas: false,
    hasAreaM2: true,
  },
];

export type PaintingAreaEntry = {
  included: boolean;
  /** Non-hull areas only; hull uses per-zone scopes. */
  percentYard: number | null;
  /** Non-hull areas only; hull coats live on `hullZones`. */
  primerCoats: number | null;
  finishCoats: number | null;
  areaM2: number | null;
  paintSystem: string | null;
  /** Per-zone treatments + coat scheme for hull. */
  hullZones: HullZonesMap;
};

export type PaintingAreasMap = Record<PaintingAreaId, PaintingAreaEntry>;

function newHullTreatmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ht-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyHullTreatment(): HullTreatmentAssignment {
  return { id: newHullTreatmentId(), treatmentType: "", percentYard: null };
}

export function createEmptyHullZoneScope(seed?: Partial<HullZoneScope>): HullZoneScope {
  return {
    treatments: seed?.treatments ?? [],
    primerCoats: seed?.primerCoats ?? null,
    finishCoats: seed?.finishCoats ?? null,
    paintSystem: seed?.paintSystem ?? "",
  };
}

export function emptyHullZones(): HullZonesMap {
  return {
    flatBottomArea: createEmptyHullZoneScope(),
    verticalBottomArea: createEmptyHullZoneScope(),
    bootTopArea: createEmptyHullZoneScope(),
    topsideArea: createEmptyHullZoneScope(),
  };
}

function emptyEntry(): PaintingAreaEntry {
  return {
    included: false,
    percentYard: null,
    primerCoats: null,
    finishCoats: null,
    areaM2: null,
    paintSystem: null,
    hullZones: emptyHullZones(),
  };
}

export function hullZoneTreatmentCount(map: HullZonesMap): number {
  return PAINTING_HULL_ZONE_FIELDS.reduce((n, z) => n + (map[z.key]?.treatments?.length ?? 0), 0);
}

export function hullZonesHaveData(map: HullZonesMap): boolean {
  return PAINTING_HULL_ZONE_FIELDS.some((z) => {
    const scope = map[z.key];
    return (
      scope.primerCoats != null ||
      scope.finishCoats != null ||
      Boolean(scope.paintSystem.trim()) ||
      scope.treatments.length > 0
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(value: unknown): number | null {
  const n = parseOptionalNumber(value);
  if (n == null) return null;
  return Number.isInteger(n) ? n : null;
}

function parsePaintSystem(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/** Preserve spaces while typing in zone paint-system fields. */
function parsePaintSystemText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function parseIncluded(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function parseHullTreatments(
  raw: unknown,
  legacyPercentYard: number | null,
): HullTreatmentAssignment[] {
  const rows: HullTreatmentAssignment[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      rows.push({
        id: String(row.id ?? "").trim() || newHullTreatmentId(),
        treatmentType: row.treatmentType == null ? "" : String(row.treatmentType),
        percentYard: parseOptionalNumber(row.percentYard),
      });
    }
  }
  if (rows.length > 0) return rows;
  if (legacyPercentYard != null) {
    return [
      {
        id: newHullTreatmentId(),
        treatmentType: "Yard painting (overall)",
        percentYard: legacyPercentYard,
      },
    ];
  }
  return [];
}

function parseHullZoneScope(
  raw: unknown,
  legacyCoats?: { primerCoats: number | null; finishCoats: number | null; paintSystem: string },
): HullZoneScope {
  if (Array.isArray(raw)) {
    // Legacy: zone value was a bare treatments array.
    return createEmptyHullZoneScope({
      treatments: parseHullTreatments(raw, null),
      primerCoats: legacyCoats?.primerCoats ?? null,
      finishCoats: legacyCoats?.finishCoats ?? null,
      paintSystem: legacyCoats?.paintSystem ?? "",
    });
  }
  if (!isRecord(raw)) {
    return createEmptyHullZoneScope({
      primerCoats: legacyCoats?.primerCoats ?? null,
      finishCoats: legacyCoats?.finishCoats ?? null,
      paintSystem: legacyCoats?.paintSystem ?? "",
    });
  }
  const treatments = parseHullTreatments(raw.treatments ?? raw.hullTreatments, null);
  return createEmptyHullZoneScope({
    treatments,
    primerCoats:
      parseOptionalInt(raw.primerCoats) ??
      parseOptionalNumber(raw.primerCoats) ??
      legacyCoats?.primerCoats ??
      null,
    finishCoats:
      parseOptionalInt(raw.finishCoats) ??
      parseOptionalNumber(raw.finishCoats) ??
      legacyCoats?.finishCoats ??
      null,
    paintSystem:
      parsePaintSystemText(raw.paintSystem) || legacyCoats?.paintSystem || "",
  });
}

function parseHullZones(
  rawZones: unknown,
  legacyFlatTreatments: unknown,
  legacyPercentYard: number | null,
  legacyHullCoats: { primerCoats: number | null; finishCoats: number | null; paintSystem: string },
): HullZonesMap {
  const map = emptyHullZones();
  const source = isRecord(rawZones)
    ? rawZones
    : isRecord(legacyFlatTreatments) && !Array.isArray(legacyFlatTreatments)
      ? null
      : null;

  // New shape: hullZones or migrated hullZoneTreatments object.
  const zoneBag = isRecord(rawZones) ? rawZones : null;
  if (zoneBag) {
    for (const zone of PAINTING_HULL_ZONE_FIELDS) {
      map[zone.key] = parseHullZoneScope(zoneBag[zone.key], legacyHullCoats);
    }
    if (hullZonesHaveData(map) || hullZoneTreatmentCount(map) > 0) return map;
  }

  // Legacy whole-hull treatments array → flat bottom (+ legacy coats on all zones).
  const legacyRows = parseHullTreatments(legacyFlatTreatments, legacyPercentYard);
  if (legacyRows.length > 0 || legacyHullCoats.primerCoats != null || legacyHullCoats.finishCoats != null || legacyHullCoats.paintSystem) {
    for (const zone of PAINTING_HULL_ZONE_FIELDS) {
      map[zone.key] = createEmptyHullZoneScope({
        treatments: zone.key === "flatBottomArea" ? legacyRows : [],
        primerCoats: legacyHullCoats.primerCoats,
        finishCoats: legacyHullCoats.finishCoats,
        paintSystem: legacyHullCoats.paintSystem,
      });
    }
  }

  void source;
  return map;
}

function parseEntry(raw: unknown, areaId?: PaintingAreaId): PaintingAreaEntry {
  if (!isRecord(raw)) return emptyEntry();
  const included = parseIncluded(raw.included);
  const percentYard = parseOptionalNumber(raw.percentYard);
  const primerCoats = parseOptionalInt(raw.primerCoats) ?? parseOptionalNumber(raw.primerCoats);
  const finishCoats = parseOptionalInt(raw.finishCoats) ?? parseOptionalNumber(raw.finishCoats);
  const paintSystem = parsePaintSystem(raw.paintSystem);

  if (areaId === "hull") {
    const hullZones = parseHullZones(
      raw.hullZones ?? raw.hullZoneTreatments,
      raw.hullTreatments,
      percentYard,
      {
        primerCoats,
        finishCoats,
        paintSystem: paintSystem ?? "",
      },
    );
    return {
      included: included === true,
      percentYard: null,
      primerCoats: null,
      finishCoats: null,
      areaM2: null,
      paintSystem: null,
      hullZones,
    };
  }

  return {
    included: included === true,
    percentYard,
    primerCoats,
    finishCoats,
    areaM2: parseOptionalNumber(raw.areaM2),
    paintSystem,
    hullZones: emptyHullZones(),
  };
}

export function hullHasZoneArea(values: Record<string, unknown>): boolean {
  return PAINTING_HULL_ZONE_FIELDS.some((zone) => {
    const n = parseOptionalNumber(values[zone.key]);
    return n != null && n >= 0;
  });
}

function hullExplicitlyExcluded(areasRaw: Record<string, unknown> | null): boolean {
  if (!areasRaw) return false;
  const hull = areasRaw.hull;
  if (!isRecord(hull)) return false;
  return parseIncluded(hull.included) === false;
}

export function seedHullZones(existing?: HullZonesMap): HullZonesMap {
  const base = existing ?? emptyHullZones();
  if (hullZonesHaveData(base)) return base;
  const next = emptyHullZones();
  for (const zone of PAINTING_HULL_ZONE_FIELDS) {
    next[zone.key] = createEmptyHullZoneScope({
      treatments: [createEmptyHullTreatment()],
    });
  }
  return next;
}

export function parsePaintingAreas(values: Record<string, unknown>): PaintingAreasMap {
  const areasRaw = isRecord(values.areas) ? values.areas : null;
  const map = {} as PaintingAreasMap;
  for (const def of PAINTING_AREA_DEFS) {
    map[def.id] = parseEntry(areasRaw?.[def.id], def.id);
  }
  if (!hullExplicitlyExcluded(areasRaw) && hullHasZoneArea(values) && !map.hull.included) {
    map.hull = {
      ...map.hull,
      included: true,
      hullZones: seedHullZones(map.hull.hullZones),
    };
  }
  return map;
}

export function serializePaintingArea(
  entry: PaintingAreaEntry,
  includeAreaM2: boolean,
  areaId?: PaintingAreaId,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    included: entry.included,
  };

  if (areaId === "hull") {
    const zoneOut: Record<string, unknown> = {};
    for (const zone of PAINTING_HULL_ZONE_FIELDS) {
      const scope = entry.hullZones[zone.key] ?? createEmptyHullZoneScope();
      zoneOut[zone.key] = {
        treatments: scope.treatments.map((row) => ({
          id: row.id,
          treatmentType: row.treatmentType,
          percentYard: row.percentYard,
        })),
        primerCoats: scope.primerCoats,
        finishCoats: scope.finishCoats,
        paintSystem: scope.paintSystem,
      };
    }
    out.hullZones = zoneOut;
  } else {
    out.primerCoats = entry.primerCoats;
    out.finishCoats = entry.finishCoats;
    out.percentYard = entry.percentYard;
    if (entry.paintSystem) out.paintSystem = entry.paintSystem;
  }

  if (includeAreaM2) out.areaM2 = entry.areaM2;
  return out;
}

export function serializePaintingAreas(
  map: PaintingAreasMap,
  context?: { hullZonesPresent?: boolean },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of PAINTING_AREA_DEFS) {
    const entry = map[def.id];
    const hasData =
      entry.included ||
      entry.percentYard != null ||
      entry.primerCoats != null ||
      entry.finishCoats != null ||
      entry.areaM2 != null ||
      Boolean(entry.paintSystem) ||
      hullZonesHaveData(entry.hullZones);
    const persistHullExclusion =
      def.id === "hull" && !entry.included && Boolean(context?.hullZonesPresent);
    if (!hasData && !persistHullExclusion) continue;
    out[def.id] = serializePaintingArea(entry, def.hasAreaM2, def.id);
  }
  return out;
}

/**
 * Tankers see cargo tanks; bulkers see cargo holds; other types can include either.
 */
export function visiblePaintingAreaIds(vesselType?: string | null): PaintingAreaId[] {
  const cargo = lockedCargoSpaceKind(vesselType);
  return PAINTING_AREA_IDS.filter((id) => {
    if (id === "cargo_holds") return cargo !== "cargo_tanks";
    if (id === "cargo_tanks") return cargo !== "cargo_holds";
    return true;
  });
}

function coatsMessage(label: string, kind: "primer" | "finish"): string {
  const name = kind === "primer" ? "Number of primer coats" : "Number of finish coats";
  return `${label}: ${name} is required (whole number ≥ 0, 0 allowed)`;
}

function filledTreatments(rows: HullTreatmentAssignment[]): HullTreatmentAssignment[] {
  return rows.filter((row) => row.treatmentType.trim() || row.percentYard != null);
}

function validateCoats(label: string, primer: number | null, finish: number | null): string | null {
  if (primer == null) return coatsMessage(label, "primer");
  if (!Number.isInteger(primer) || primer < 0) return coatsMessage(label, "primer");
  if (finish == null) return coatsMessage(label, "finish");
  if (!Number.isInteger(finish) || finish < 0) return coatsMessage(label, "finish");
  return null;
}

function isEmptyIncludedShell(entry: PaintingAreaEntry, areaId: PaintingAreaId): boolean {
  if (!entry.included) return false;
  if (areaId === "hull") return !hullZonesHaveData(entry.hullZones);
  return (
    entry.percentYard == null &&
    entry.primerCoats == null &&
    entry.finishCoats == null &&
    entry.areaM2 == null &&
    !entry.paintSystem
  );
}

/** Drop empty included shells so Submit is not blocked by leftover auto-include rows. */
export function sanitizePaintingValues(values: Record<string, unknown>): Record<string, unknown> {
  const areas = parsePaintingAreas(values);
  let changed = false;
  for (const def of PAINTING_AREA_DEFS) {
    if (!isEmptyIncludedShell(areas[def.id], def.id)) continue;
    areas[def.id] = { ...areas[def.id], included: false };
    changed = true;
  }
  if (!changed) return values;
  return {
    ...values,
    areas: serializePaintingAreas(areas, { hullZonesPresent: hullHasZoneArea(values) }),
  };
}

export function validatePaintingCoating(values: Record<string, unknown>): string | null {
  const areas = parsePaintingAreas(values);

  for (const def of PAINTING_AREA_DEFS) {
    const entry = areas[def.id];
    if (!entry.included) continue;
    if (isEmptyIncludedShell(entry, def.id)) continue;

    if (def.id === "hull") {
      const zonesWithArea = PAINTING_HULL_ZONE_FIELDS.filter((zone) => {
        const n = parseOptionalNumber(values[zone.key]);
        return n != null && n > 0;
      });
      const zonesToCheck =
        zonesWithArea.length > 0 ? zonesWithArea : [...PAINTING_HULL_ZONE_FIELDS];

      let anyFilled = false;
      for (const zone of zonesToCheck) {
        const scope = entry.hullZones[zone.key] ?? createEmptyHullZoneScope();
        const treatments = filledTreatments(scope.treatments);
        if (treatments.length === 0) {
          if (zonesWithArea.length > 0) {
            return `Hull — ${zone.label}: add at least one treatment with yard area % (e.g. SA 2 — 35%)`;
          }
          continue;
        }
        anyFilled = true;
        for (const row of treatments) {
          if (!row.treatmentType.trim()) {
            return `Hull — ${zone.label}: treatment type is required for each row`;
          }
          if (row.percentYard == null) {
            return `Hull — ${zone.label}: enter % of this zone for “${row.treatmentType.trim()}” (0–100, 0 allowed)`;
          }
          if (row.percentYard < 0 || row.percentYard > 100) {
            return `Hull — ${zone.label}: % for “${row.treatmentType.trim()}” must be between 0 and 100`;
          }
        }
        const coatsErr = validateCoats(
          `Hull — ${zone.label}`,
          scope.primerCoats,
          scope.finishCoats,
        );
        if (coatsErr) return coatsErr;
      }
      if (!anyFilled) {
        return "Hull: add treatments and coat scheme for each hull zone (flat bottom, vertical bottom, boot top, topside)";
      }
    } else {
      if (entry.percentYard == null) {
        return `${def.label}: enter % of this area for yard painting (0–100, 0 allowed)`;
      }
      if (entry.percentYard < 0 || entry.percentYard > 100) {
        return `${def.label}: % of this area for yard painting must be between 0 and 100`;
      }
      const coatsErr = validateCoats(def.label, entry.primerCoats, entry.finishCoats);
      if (coatsErr) return coatsErr;
    }

    if (def.hasAreaM2 && entry.areaM2 != null && entry.areaM2 < 0) {
      return `${def.label}: area m² cannot be negative`;
    }
  }

  for (const zone of PAINTING_HULL_ZONE_FIELDS) {
    const n = parseOptionalNumber(values[zone.key]);
    if (n != null && n < 0) {
      return `${zone.label} area cannot be negative`;
    }
  }

  return null;
}
