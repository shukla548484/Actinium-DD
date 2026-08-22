export const LSA_COUNT_ITEMS = [
  { key: "lifeboats", label: "Lifeboats" },
  { key: "rescueBoats", label: "Rescue boats" },
  { key: "lifeRafts", label: "Life rafts" },
  { key: "lifejackets", label: "Lifejackets" },
  { key: "immersionSuits", label: "Immersion suits" },
  { key: "lifebuoys", label: "Lifebuoys" },
  { key: "epirb", label: "EPIRB" },
  { key: "sart", label: "SART" },
  { key: "lineThrowing", label: "Line-throwing appliances" },
  { key: "parachuteFlares", label: "Rocket parachute flares" },
  { key: "handFlares", label: "Hand flares" },
  { key: "smokeSignals", label: "Buoyant smoke signals" },
] as const;

export const FFA_COUNT_ITEMS = [
  { key: "extFoam", label: "Fire extinguishers — Foam" },
  { key: "extCo2", label: "Fire extinguishers — CO2" },
  { key: "extDryPowder", label: "Fire extinguishers — Dry powder" },
  { key: "extWater", label: "Fire extinguishers — Water" },
  { key: "extWetChemical", label: "Fire extinguishers — Wet chemical" },
  { key: "fireHoses", label: "Fire hoses" },
  { key: "hydrantsNozzles", label: "Fire hydrants / nozzles" },
  { key: "firemanOutfits", label: "Fireman's outfits" },
  { key: "baSets", label: "Breathing apparatus (BA / SCBA)" },
  { key: "emergencyFirePump", label: "Emergency fire pump" },
  { key: "fixedCo2Bottles", label: "Fixed CO2 bottles" },
  { key: "foamMonitors", label: "Foam monitors / tanks" },
] as const;

export type SafetyCountMap = Record<string, number | null>;

function isFilledNumber(value: unknown): boolean {
  if (value === "" || value == null) return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function parseSafetyCountMap(value: unknown): SafetyCountMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: SafetyCountMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === "" || raw == null) {
      out[key] = null;
      continue;
    }
    const n = typeof raw === "number" ? raw : Number(raw);
    out[key] = Number.isFinite(n) ? n : null;
  }
  return out;
}

export function safetyCountsMissingLabel(
  counts: unknown,
  items: readonly { key: string; label: string }[],
  groupLabel: string,
): string | null {
  const map = parseSafetyCountMap(counts);
  const missing = items.filter((item) => !isFilledNumber(map[item.key]));
  if (missing.length === 0) return null;
  return `${groupLabel}: enter a number for every item (0 is allowed). Missing: ${missing
    .map((i) => i.label)
    .join(", ")}`;
}

export function validateSafetyEquipmentCounts(values: Record<string, unknown>): string | null {
  return (
    safetyCountsMissingLabel(values.lsaCounts, LSA_COUNT_ITEMS, "LSA item counts") ??
    safetyCountsMissingLabel(values.ffaCounts, FFA_COUNT_ITEMS, "FFA item counts")
  );
}
