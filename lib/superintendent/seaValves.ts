export const SEA_VALVE_GROUP_KEYS = [
  "engine_room_overboard",
  "ballast_overboard",
  "cargo_overboard",
  "cargo_system",
  "draft_gauge",
  "nx1",
  "nx2",
] as const;

export type SeaValveGroupKey = (typeof SEA_VALVE_GROUP_KEYS)[number];

export const SEA_VALVE_GROUPS: { key: SeaValveGroupKey; label: string }[] = [
  { key: "engine_room_overboard", label: "Engine room overboard valves" },
  { key: "ballast_overboard", label: "Ballast system overboard valves" },
  { key: "cargo_overboard", label: "Cargo system overboard valves" },
  { key: "cargo_system", label: "Cargo system valves" },
  { key: "draft_gauge", label: "Draft gauge valves" },
  { key: "nx1", label: "NX-1 valves" },
  { key: "nx2", label: "NX-2 valves" },
];

export const SEA_VALVE_OVERHAUL_LOCATIONS = [
  { value: "in_situ", label: "In situ (in place)" },
  { value: "workshop", label: "Workshop" },
] as const;

export type SeaValveOverhaulLocation = (typeof SEA_VALVE_OVERHAUL_LOCATIONS)[number]["value"];

/** JIS class sizes plus typical sea-valve types. Custom / other text is also allowed. */
export const SEA_VALVE_SPEC_OPTIONS = [
  { value: "5K10", label: "5K10" },
  { value: "5K12", label: "5K12" },
  { value: "5K16", label: "5K16" },
  { value: "5K20", label: "5K20" },
  { value: "5K25", label: "5K25" },
  { value: "10K16", label: "10K16" },
  { value: "10K20", label: "10K20" },
  { value: "10K25", label: "10K25" },
  { value: "16K20", label: "16K20" },
  { value: "Butterfly", label: "Butterfly" },
  { value: "Angle type", label: "Angle type" },
  { value: "Gate", label: "Gate" },
  { value: "Globe", label: "Globe" },
  { value: "SDNR", label: "SDNR" },
  { value: "Storm valve", label: "Storm valve" },
] as const;

export type SeaValveRow = {
  id: string;
  group: SeaValveGroupKey;
  spec: string;
  overhaulLocation: SeaValveOverhaulLocation | "";
  locationName: string;
  notes: string;
};

const GROUP_SET = new Set<string>(SEA_VALVE_GROUP_KEYS);
const OVERHAUL_SET = new Set<string>(SEA_VALVE_OVERHAUL_LOCATIONS.map((o) => o.value));

const GROUP_ALIASES: Array<{ key: SeaValveGroupKey; aliases: string[] }> = [
  {
    key: "engine_room_overboard",
    aliases: [
      "engine room overboard valves",
      "engine room overboard",
      "er overboard valves",
      "er overboard",
      "engine overboard",
    ],
  },
  {
    key: "ballast_overboard",
    aliases: [
      "ballast system overboard valves",
      "ballast system overboard",
      "ballast overboard valves",
      "ballast overboard",
    ],
  },
  {
    key: "cargo_overboard",
    aliases: [
      "cargo system overboard valves",
      "cargo system overboard",
      "cargo overboard valves",
      "cargo overboard",
    ],
  },
  {
    key: "cargo_system",
    aliases: ["cargo system valves", "cargo system", "cargo valves"],
  },
  {
    key: "draft_gauge",
    aliases: ["draft gauge valves", "draught gauge valves", "draft gauge", "draught gauge"],
  },
  { key: "nx1", aliases: ["nx-1 valves", "nx1 valves", "nx 1 valves", "nx-1", "nx1", "nx 1"] },
  { key: "nx2", aliases: ["nx-2 valves", "nx2 valves", "nx 2 valves", "nx-2", "nx2", "nx 2"] },
];

function blank(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function newSeaValveId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function seaValveGroupLabel(key: SeaValveGroupKey): string {
  return SEA_VALVE_GROUPS.find((g) => g.key === key)?.label ?? key;
}

export function parseSeaValveGroup(value: unknown): SeaValveGroupKey | null {
  const raw = blank(value).toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return null;
  if (GROUP_SET.has(blank(value))) return blank(value) as SeaValveGroupKey;
  const compact = raw.replace(/[\s-]+/g, "_");
  if (GROUP_SET.has(compact)) return compact as SeaValveGroupKey;
  for (const { key, aliases } of GROUP_ALIASES) {
    if (aliases.some((alias) => raw === alias || raw.includes(alias))) return key;
  }
  return null;
}

export function parseSeaValveOverhaulLocation(value: unknown): SeaValveOverhaulLocation | "" {
  const raw = blank(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return "";
  if (OVERHAUL_SET.has(blank(value))) return blank(value) as SeaValveOverhaulLocation;
  if (
    raw === "in situ" ||
    raw === "in place" ||
    raw === "in situ (in place)" ||
    raw === "insitu" ||
    raw.includes("in situ") ||
    raw.includes("in place")
  ) {
    return "in_situ";
  }
  if (raw === "workshop" || raw === "shop" || raw.includes("workshop")) return "workshop";
  return "";
}

export function createSeaValveRow(group: SeaValveGroupKey): SeaValveRow {
  return {
    id: newSeaValveId(),
    group,
    spec: "",
    overhaulLocation: "",
    locationName: "",
    notes: "",
  };
}

function parseRow(raw: unknown): SeaValveRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const group = parseSeaValveGroup(row.group);
  if (!group) return null;
  const spec = blank(row.spec);
  const overhaulLocation = parseSeaValveOverhaulLocation(row.overhaulLocation);
  const locationName = blank(row.locationName);
  const notes = blank(row.notes);
  const id = blank(row.id) || newSeaValveId();
  return { id, group, spec, overhaulLocation, locationName, notes };
}

export function parseSeaValveRows(value: unknown): SeaValveRow[] {
  if (!Array.isArray(value)) return [];
  const rows: SeaValveRow[] = [];
  for (const item of value) {
    const row = parseRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

export function parseSeaValvesFromValues(values: Record<string, unknown> | null | undefined): SeaValveRow[] {
  if (!values) return [];
  return parseSeaValveRows(values.valves);
}

export function seaValveRowHasContent(row: Pick<SeaValveRow, "spec" | "overhaulLocation" | "locationName" | "notes">): boolean {
  return Boolean(row.spec.trim() || row.overhaulLocation || row.locationName.trim() || row.notes.trim());
}

export function countSeaValveOverhaul(rows: SeaValveRow[]): { inSitu: number; workshop: number; total: number } {
  let inSitu = 0;
  let workshop = 0;
  for (const row of rows) {
    if (!seaValveRowHasContent(row)) continue;
    if (row.overhaulLocation === "in_situ") inSitu += 1;
    else if (row.overhaulLocation === "workshop") workshop += 1;
  }
  return { inSitu, workshop, total: inSitu + workshop };
}

export function seaValveRowKey(
  row: Pick<SeaValveRow, "group" | "spec" | "overhaulLocation" | "locationName">,
): string {
  return [
    row.group,
    row.spec.trim().toLowerCase(),
    row.overhaulLocation,
    row.locationName.trim().toLowerCase(),
  ].join("::");
}

export function cloneSeaValveRows(rows: SeaValveRow[]): SeaValveRow[] {
  return rows.map((row) => ({ ...row, id: newSeaValveId() }));
}

export function mergeSeaValveRows(existing: SeaValveRow[], incoming: SeaValveRow[]): {
  merged: SeaValveRow[];
  imported: number;
  skipped: number;
} {
  const seen = new Set(existing.map(seaValveRowKey));
  const merged = [...existing];
  let imported = 0;
  let skipped = 0;
  for (const row of incoming) {
    if (!seaValveRowHasContent(row)) continue;
    const key = seaValveRowKey(row);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    merged.push({ ...row, id: row.id || newSeaValveId() });
    imported += 1;
  }
  return { merged, imported, skipped };
}

export function sanitizeSeaValveValues(values: Record<string, unknown>): Record<string, unknown> {
  const valves = parseSeaValveRows(values.valves).filter(seaValveRowHasContent);
  const notes = blank(values.notes);
  return {
    ...values,
    valves,
    notes: notes || undefined,
  };
}

export function validateSeaValves(values: Record<string, unknown>): string | null {
  const rows = parseSeaValveRows(values.valves).filter(seaValveRowHasContent);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const label = row.locationName.trim() || seaValveGroupLabel(row.group);
    if (!row.spec.trim()) {
      return `${label}: specification / type is required`;
    }
    if (row.overhaulLocation !== "in_situ" && row.overhaulLocation !== "workshop") {
      return `${label}: overhaul location is required (In situ or Workshop)`;
    }
  }
  return null;
}
