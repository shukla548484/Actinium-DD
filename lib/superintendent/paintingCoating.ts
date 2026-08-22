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
    hint: "Flat bottom, vertical bottom, boot top, and topside. One yard % and coat count for all hull zones.",
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
  percentYard: number | null;
  primerCoats: number | null;
  finishCoats: number | null;
  areaM2: number | null;
  paintSystem: string | null;
};

export type PaintingAreasMap = Record<PaintingAreaId, PaintingAreaEntry>;

function emptyEntry(): PaintingAreaEntry {
  return {
    included: false,
    percentYard: null,
    primerCoats: null,
    finishCoats: null,
    areaM2: null,
    paintSystem: null,
  };
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

function parseIncluded(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function parseEntry(raw: unknown): PaintingAreaEntry {
  if (!isRecord(raw)) return emptyEntry();
  const included = parseIncluded(raw.included);
  return {
    included: included === true,
    percentYard: parseOptionalNumber(raw.percentYard),
    primerCoats: parseOptionalInt(raw.primerCoats) ?? parseOptionalNumber(raw.primerCoats),
    finishCoats: parseOptionalInt(raw.finishCoats) ?? parseOptionalNumber(raw.finishCoats),
    areaM2: parseOptionalNumber(raw.areaM2),
    paintSystem: parsePaintSystem(raw.paintSystem),
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

export function parsePaintingAreas(values: Record<string, unknown>): PaintingAreasMap {
  const areasRaw = isRecord(values.areas) ? values.areas : null;
  const map = {} as PaintingAreasMap;
  for (const def of PAINTING_AREA_DEFS) {
    map[def.id] = parseEntry(areasRaw?.[def.id]);
  }
  if (!hullExplicitlyExcluded(areasRaw) && hullHasZoneArea(values) && !map.hull.included) {
    map.hull = { ...map.hull, included: true };
  }
  return map;
}

export function serializePaintingArea(entry: PaintingAreaEntry, includeAreaM2: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    included: entry.included,
    percentYard: entry.percentYard,
    primerCoats: entry.primerCoats,
    finishCoats: entry.finishCoats,
  };
  if (includeAreaM2) out.areaM2 = entry.areaM2;
  if (entry.paintSystem) out.paintSystem = entry.paintSystem;
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
      Boolean(entry.paintSystem);
    const persistHullExclusion =
      def.id === "hull" && !entry.included && Boolean(context?.hullZonesPresent);
    if (!hasData && !persistHullExclusion) continue;
    out[def.id] = serializePaintingArea(entry, def.hasAreaM2);
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

export function validatePaintingCoating(values: Record<string, unknown>): string | null {
  const areas = parsePaintingAreas(values);

  for (const def of PAINTING_AREA_DEFS) {
    const entry = areas[def.id];
    if (!entry.included) continue;

    if (entry.percentYard == null) {
      return `${def.label}: enter % of this area for yard painting (0–100, 0 allowed)`;
    }
    if (entry.percentYard < 0 || entry.percentYard > 100) {
      return `${def.label}: % of this area for yard painting must be between 0 and 100`;
    }

    if (entry.primerCoats == null) {
      return coatsMessage(def.label, "primer");
    }
    if (!Number.isInteger(entry.primerCoats) || entry.primerCoats < 0) {
      return coatsMessage(def.label, "primer");
    }
    if (entry.finishCoats == null) {
      return coatsMessage(def.label, "finish");
    }
    if (!Number.isInteger(entry.finishCoats) || entry.finishCoats < 0) {
      return coatsMessage(def.label, "finish");
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
