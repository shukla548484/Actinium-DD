/** Standard dry-dock tender cost categories (01–22). */
export interface StandardCategoryDef {
  categoryNo: string;
  slug: string;
  name: string;
  shortcut: string;
}

export const STANDARD_DOCKING_CATEGORIES: StandardCategoryDef[] = [
  { categoryNo: "01", slug: "docking_cost", name: "Docking Cost", shortcut: "1" },
  { categoryNo: "02", slug: "general_service_cost", name: "General Service Cost", shortcut: "2" },
  { categoryNo: "03", slug: "hull_cleaning_painting", name: "Hull Cleaning & Painting", shortcut: "3" },
  { categoryNo: "04", slug: "steel_renewal", name: "Steel Renewal", shortcut: "4" },
  { categoryNo: "05", slug: "cargo_hold_tank_coating", name: "Cargo Hold/Tank Coating", shortcut: "5" },
  { categoryNo: "06", slug: "sea_valves_overboard", name: "Sea Valves & Overboard Valves", shortcut: "6" },
  { categoryNo: "07", slug: "rudder_propeller", name: "Rudder & Propeller", shortcut: "7" },
  { categoryNo: "08", slug: "main_engine", name: "Main Engine", shortcut: "8" },
  { categoryNo: "09", slug: "auxiliary_engines", name: "Auxiliary Engines", shortcut: "9" },
  { categoryNo: "10", slug: "boilers", name: "Boilers", shortcut: "0" },
  { categoryNo: "11", slug: "deck_machinery", name: "Deck Machinery", shortcut: "A" },
  { categoryNo: "12", slug: "cargo_gear", name: "Cargo Gear", shortcut: "B" },
  { categoryNo: "13", slug: "electrical", name: "Electrical", shortcut: "C" },
  { categoryNo: "14", slug: "automation", name: "Automation", shortcut: "D" },
  { categoryNo: "15", slug: "bwts", name: "BWTS", shortcut: "E" },
  { categoryNo: "16", slug: "class_statutory", name: "Class & Statutory Surveys", shortcut: "F" },
  { categoryNo: "17", slug: "spares", name: "Spares", shortcut: "G" },
  { categoryNo: "18", slug: "stores_consumables", name: "Stores & Consumables", shortcut: "H" },
  { categoryNo: "19", slug: "paints", name: "Paints", shortcut: "I" },
  { categoryNo: "20", slug: "agency_logistics", name: "Agency & Logistics", shortcut: "J" },
  { categoryNo: "21", slug: "miscellaneous", name: "Miscellaneous", shortcut: "K" },
  { categoryNo: "22", slug: "contingency", name: "Contingency", shortcut: "L" },
];

/** Map legacy spec bucket slugs → standard category slugs. */
export const LEGACY_BUCKET_TO_SLUG: Record<string, string> = {
  docking: "docking_cost",
  general_services: "general_service_cost",
  utilities: "general_service_cost",
  hull_prep: "hull_cleaning_painting",
  hull_paint: "hull_cleaning_painting",
  steel: "steel_renewal",
  machinery: "main_engine",
  other: "miscellaneous",
};

export function normalizeCategorySlug(bucket: string): string {
  return LEGACY_BUCKET_TO_SLUG[bucket] ?? bucket;
}

export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function formatCategoryNo(n: number): string {
  return String(n).padStart(2, "0");
}

export function nextCategoryNumber(existingNos: string[]): string {
  const nums = existingNos
    .map((no) => parseInt(no, 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return formatCategoryNo(max + 1);
}

export interface CategoryLabelSource {
  categoryNo: string;
  slug: string;
  name: string;
  shortcut: string;
}

export function formatCategoryLabel(cat: CategoryLabelSource): string {
  return `${cat.categoryNo} ${cat.name}`;
}

export function categoryLabelFromList(
  categories: CategoryLabelSource[],
  slug: string,
): string {
  const normalized = normalizeCategorySlug(slug);
  const cat = categories.find((c) => c.slug === normalized);
  if (cat) return formatCategoryLabel(cat);
  const std = STANDARD_DOCKING_CATEGORIES.find((c) => c.slug === normalized);
  if (std) return formatCategoryLabel(std);
  return slug;
}

/** Resolve category slug from import text (name, number, or legacy bucket). */
export function resolveCategorySlugFromImport(
  raw: string,
  categories: CategoryLabelSource[],
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "miscellaneous";

  const byNo = categories.find((c) => c.categoryNo === trimmed.padStart(2, "0"));
  if (byNo) return byNo.slug;

  const bySlug = categories.find((c) => c.slug === trimmed.toLowerCase());
  if (bySlug) return bySlug.slug;

  const lower = trimmed.toLowerCase();
  const byName = categories.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.slug;

  const std = STANDARD_DOCKING_CATEGORIES.find(
    (c) =>
      c.slug === lower ||
      c.name.toLowerCase() === lower ||
      c.categoryNo === trimmed.padStart(2, "0"),
  );
  if (std) return std.slug;

  return normalizeCategorySlug(lower.replace(/\s+/g, "_"));
}
