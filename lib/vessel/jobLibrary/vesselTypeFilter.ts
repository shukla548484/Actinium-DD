/** Filter job library root departments by vessel type keyword. */

const ROOT_BY_VESSEL_KEY: Record<string, Set<string>> = {
  tanker: new Set([
    "machinery_jobs",
    "hull_jobs",
    "tank_jobs",
    "cargo_jobs",
    "pipe_jobs",
    "valve_jobs",
    "electrical_jobs",
    "deck_machinery",
    "safety_jobs",
    "navigation_jobs",
    "instrumentation_jobs",
  ]),
  bulk: new Set([
    "machinery_jobs",
    "hull_jobs",
    "cargo_jobs",
    "deck_machinery",
    "pipe_jobs",
    "valve_jobs",
    "electrical_jobs",
    "safety_jobs",
    "navigation_jobs",
  ]),
  container: new Set([
    "machinery_jobs",
    "hull_jobs",
    "electrical_jobs",
    "deck_machinery",
    "safety_jobs",
    "navigation_jobs",
    "instrumentation_jobs",
  ]),
  offshore: new Set([
    "machinery_jobs",
    "hull_jobs",
    "deck_machinery",
    "safety_jobs",
    "navigation_jobs",
    "electrical_jobs",
    "new_installations",
  ]),
  passenger: new Set([
    "machinery_jobs",
    "hull_jobs",
    "accommodation_jobs",
    "electrical_jobs",
    "safety_jobs",
    "navigation_jobs",
    "deck_machinery",
  ]),
};

function normalizeVesselTypeKey(vesselType: string): string | null {
  const v = vesselType.toLowerCase();
  if (v.includes("tank")) return "tanker";
  if (v.includes("bulk") || v.includes("carrier")) return "bulk";
  if (v.includes("container")) return "container";
  if (v.includes("offshore") || v.includes("supply") || v.includes("ahts")) return "offshore";
  if (v.includes("passenger") || v.includes("cruise") || v.includes("ro-pax")) return "passenger";
  return null;
}

export function filterJobLibraryRootsByVesselType<T extends { code: string }>(
  nodes: T[],
  vesselType?: string | null,
): T[] {
  if (!vesselType?.trim()) return nodes;
  const key = normalizeVesselTypeKey(vesselType.trim());
  if (!key) return nodes;
  const allowed = ROOT_BY_VESSEL_KEY[key];
  if (!allowed) return nodes;
  return nodes.filter((n) => allowed.has(n.code));
}
