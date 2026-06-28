/** Shipyard workshops — execution-side teams (not owner/superintendent modules). */
export interface ShipyardWorkshopDef {
  slug: string;
  name: string;
  shortName: string;
  typicalScope: string;
  sortOrder: number;
}

export const SHIPYARD_WORKSHOPS: ShipyardWorkshopDef[] = [
  {
    slug: "docking-team",
    name: "Docking Team",
    shortName: "Docking",
    typicalScope: "Docking, undocking, shifting, mooring, blocks, tug coordination",
    sortOrder: 1,
  },
  {
    slug: "hull",
    name: "Hull Workshop",
    shortName: "Hull",
    typicalScope: "Hull cleaning, sea chest, marks, shell access, bottom work",
    sortOrder: 2,
  },
  {
    slug: "steel",
    name: "Steel Workshop",
    shortName: "Steel",
    typicalScope: "Crop/renew, welding, inserts, brackets, foundations",
    sortOrder: 3,
  },
  {
    slug: "painting",
    name: "Painting Workshop",
    shortName: "Painting",
    typicalScope: "Blasting, hydro blasting, coating, DFT, weather windows",
    sortOrder: 4,
  },
  {
    slug: "tank-coating",
    name: "Tank / Coating Workshop",
    shortName: "Tank / Coating",
    typicalScope: "Ballast tanks, cargo tanks, holds, dehumidification, ventilation",
    sortOrder: 5,
  },
  {
    slug: "machinery",
    name: "Machinery Workshop",
    shortName: "Machinery",
    typicalScope: "ME, AE, pumps, purifiers, compressors, boiler, FWG, IGG",
    sortOrder: 6,
  },
  {
    slug: "pipe",
    name: "Pipe Workshop",
    shortName: "Pipe",
    typicalScope: "Pipe renewal, fabrication, pressure test, supports",
    sortOrder: 7,
  },
  {
    slug: "valve",
    name: "Valve Workshop",
    shortName: "Valve",
    typicalScope: "Sea valves, overboard valves, remote valves, pressure testing",
    sortOrder: 8,
  },
  {
    slug: "electrical",
    name: "Electrical Workshop",
    shortName: "Electrical",
    typicalScope: "Motors, cables, switchboards, navigation, automation",
    sortOrder: 9,
  },
  {
    slug: "deck-machinery",
    name: "Deck Machinery Workshop",
    shortName: "Deck Mach.",
    typicalScope: "Windlass, mooring winch, cranes, hatch covers",
    sortOrder: 10,
  },
  {
    slug: "safety-qa",
    name: "Safety / QA-QC",
    shortName: "Safety / QA-QC",
    typicalScope: "Permits, gas-free, fire watch, inspection, NDT, class hold points",
    sortOrder: 11,
  },
  {
    slug: "logistics",
    name: "Logistics Team",
    shortName: "Logistics",
    typicalScope: "Crane, forklift, materials, spares movement, scaffolding",
    sortOrder: 12,
  },
];

export const WORKSHOPS = SHIPYARD_WORKSHOPS;

export function getWorkshopBySlug(slug: string): ShipyardWorkshopDef | undefined {
  return SHIPYARD_WORKSHOPS.find((w) => w.slug === slug);
}

export const workshopBySlug = getWorkshopBySlug;

/** Map tender spec category → default workshop for job allocation. */
export const SPEC_BUCKET_TO_WORKSHOP: Record<string, string> = {
  docking_cost: "docking-team",
  general_service_cost: "logistics",
  hull_cleaning_painting: "hull",
  steel_renewal: "steel",
  cargo_hold_tank_coating: "tank-coating",
  sea_valves_overboard: "valve",
  rudder_propeller: "machinery",
  main_engine: "machinery",
  auxiliary_engines: "machinery",
  boilers: "machinery",
  deck_machinery: "deck-machinery",
  cargo_gear: "deck-machinery",
  electrical: "electrical",
  automation: "electrical",
  bwts: "machinery",
  class_statutory: "safety-qa",
  spares: "logistics",
  stores_consumables: "logistics",
  paints: "painting",
  agency_logistics: "logistics",
  miscellaneous: "logistics",
  contingency: "logistics",
};

export function workshopForSpecBucket(bucket: string): ShipyardWorkshopDef {
  const slug = SPEC_BUCKET_TO_WORKSHOP[bucket] ?? "logistics";
  return getWorkshopBySlug(slug) ?? SHIPYARD_WORKSHOPS[SHIPYARD_WORKSHOPS.length - 1]!;
}

/** Conceptual dry-dock chain (for UI documentation). */
export const DEPENDENCY_CHAIN_TEMPLATE: { jobTitle: string; workshopSlug: string }[] = [
  { jobTitle: "Docking completed", workshopSlug: "docking-team" },
  { jobTitle: "Hull washing", workshopSlug: "hull" },
  { jobTitle: "Sea chest opening", workshopSlug: "hull" },
  { jobTitle: "Sea valve removal", workshopSlug: "valve" },
  { jobTitle: "Valve overhaul", workshopSlug: "valve" },
  { jobTitle: "Valve reinstallation", workshopSlug: "valve" },
  { jobTitle: "Pressure test", workshopSlug: "valve" },
  { jobTitle: "Class inspection", workshopSlug: "safety-qa" },
  { jobTitle: "Hull painting", workshopSlug: "painting" },
  { jobTitle: "Undocking", workshopSlug: "docking-team" },
];

/** Code-based links applied when workshop jobs are seeded from owner spec. */
export const DEPENDENCY_CHAIN_LINKS: {
  predecessorCode: string;
  successorCode: string;
  lagDays?: number;
}[] = [
  { predecessorCode: "DD-003", successorCode: "HP-01" },
  { predecessorCode: "HP-01", successorCode: "PC-01" },
  { predecessorCode: "ST-001", successorCode: "ST-002" },
  { predecessorCode: "ST-002", successorCode: "MC-001" },
];

export const CRITICAL_PATH_JOB_CODES = ["DD-003", "HP-01", "PC-01", "ST-001", "MC-001"];
