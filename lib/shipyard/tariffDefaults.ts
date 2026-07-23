import type { ShipyardTariffGroup } from "@prisma/client";

export type DefaultTariffRate = {
  groupKey: ShipyardTariffGroup;
  label: string;
  unit: string;
  unitRate: number;
  notes?: string;
  sortOrder: number;
};

export const SHIPYARD_TARIFF_GROUP_LABELS: Record<ShipyardTariffGroup, string> = {
  steel_renewal: "Steel renewal",
  pipeline_renewal: "Pipeline renewal",
  pipeline_replacement: "Pipeline replacement",
  pipeline_fabrication: "Pipeline fabrication",
  walls_overhauling: "Walls overhauling",
  paint_hull: "Paint — hull",
  paint_cargo_holds: "Paint — cargo holds",
  paint_ballast_tanks: "Paint — ballast tanks",
  paint_chain_anchor: "Paint — chain / anchor",
  paint_other: "Paint — other locations",
  seam_renewal_welding: "Seam renewal / hull welding",
  other: "Other tariffs",
};

/** Default tariff rows seeded for a new yard schedule. */
export const DEFAULT_SHIPYARD_TARIFF_RATES: DefaultTariffRate[] = [
  { groupKey: "steel_renewal", label: "Mild steel plate renewal", unit: "kg", unitRate: 0, sortOrder: 1 },
  { groupKey: "steel_renewal", label: "High-tensile steel renewal", unit: "kg", unitRate: 0, sortOrder: 2 },
  { groupKey: "pipeline_renewal", label: "Pipe renewal (carbon steel)", unit: "m", unitRate: 0, sortOrder: 1 },
  { groupKey: "pipeline_replacement", label: "Pipe replacement (incl. fittings)", unit: "m", unitRate: 0, sortOrder: 1 },
  { groupKey: "pipeline_fabrication", label: "Pipe fabrication / spool", unit: "m", unitRate: 0, sortOrder: 1 },
  { groupKey: "walls_overhauling", label: "Bulkhead / wall overhaul", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "paint_hull", label: "Hull paint application (underwater)", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "paint_hull", label: "Hull paint application (topsides)", unit: "m2", unitRate: 0, sortOrder: 2 },
  { groupKey: "paint_cargo_holds", label: "Cargo hold coating", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "paint_ballast_tanks", label: "Ballast tank coating", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "paint_chain_anchor", label: "Anchor chain / locker coating", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "paint_other", label: "Other paint application", unit: "m2", unitRate: 0, sortOrder: 1 },
  { groupKey: "seam_renewal_welding", label: "Seam renewal welding on hull", unit: "m", unitRate: 0, sortOrder: 1 },
  { groupKey: "seam_renewal_welding", label: "Fillet / butt welding (general)", unit: "m", unitRate: 0, sortOrder: 2 },
  { groupKey: "other", label: "General yard service (lump sum)", unit: "ls", unitRate: 0, sortOrder: 1 },
];
