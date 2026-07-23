import type { ShipyardQuoteJobCategory } from "@prisma/client";

export const SHIPYARD_QUOTE_JOB_CATEGORY_LABELS: Record<ShipyardQuoteJobCategory, string> = {
  deck: "Deck jobs",
  machinery: "Machinery jobs",
  hull_walls_overboard: "Hull / walls / overboard",
  painting: "Painting jobs",
  other: "Other shipyard jobs",
};

export const SHIPYARD_QUOTE_JOB_CATEGORY_ORDER: ShipyardQuoteJobCategory[] = [
  "deck",
  "machinery",
  "hull_walls_overboard",
  "painting",
  "other",
];

export const SHIPYARD_DOCK_CYCLE_LABELS = {
  first_special: "First special dry dock",
  second_special: "Second special dry dock",
  third_special: "Third special dry dock",
  intermediate: "Intermediate dry dock",
  other: "Other / occasional",
} as const;

/** Map vessel-job category / workshop into quotation buckets. */
export function mapJobToQuoteCategory(input: {
  category?: string | null;
  workshop?: string | null;
  title?: string | null;
}): ShipyardQuoteJobCategory {
  const hay = [input.category, input.workshop, input.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/paint|coating|blast| antifoul|epoxy/.test(hay)) return "painting";
  if (/deck|hatch|mooring|winch|crane|cargo gear|life.?boat|gangway/.test(hay)) return "deck";
  if (
    /hull|steel|wall|overboard|sea.?chest|shell|plate|tank.?boundary|rudder|anchor.?chain/.test(
      hay,
    )
  ) {
    return "hull_walls_overboard";
  }
  if (
    /machinery|engine|pump|boiler|compressor|generator|electrical|me\b|ae\b|piping|valve|purifier/.test(
      hay,
    )
  ) {
    return "machinery";
  }
  return "other";
}
