import type { HullZoneDefinition, PrepServiceDefinition } from "@/lib/hull/types";

/** Hull levels / zones — prep intensity differs by underwater exposure. */
export const HULL_ZONES: HullZoneDefinition[] = [
  {
    id: "boot-top",
    name: "Boot Top",
    aliases: [
      "boot top",
      "boottop",
      "boot-top",
      "boot top area",
      "waterline band",
      "wl band",
    ],
  },
  {
    id: "flat-bottom",
    name: "Flat Bottom",
    aliases: [
      "flat bottom",
      "horizontal bottom",
      "bottom plate",
      "flat bottom area",
    ],
  },
  {
    id: "vertical-bottom",
    name: "Vertical Bottom (Side Bottom)",
    aliases: [
      "vertical bottom",
      "vert bottom",
      "side bottom",
      "turn of bilge",
      "billet",
      "vertical bottom area",
      "v bottom",
    ],
  },
  {
    id: "vertical-side",
    name: "Vertical Side",
    aliases: [
      "vertical side",
      "side shell",
      "vertical sides",
      "side area",
      "side shell area",
    ],
  },
  {
    id: "topside",
    name: "Topside",
    aliases: ["topside", "top side", "topsides", "above wl", "above waterline"],
  },
  {
    id: "full-hull",
    name: "Full Hull",
    aliases: ["full hull", "entire hull", "total hull", "hull total"],
  },
];

/** Surface preparation & pre-paint treatments — typically priced per m². */
export const PREP_SERVICES: PrepServiceDefinition[] = [
  {
    id: "spot-blasting",
    name: "Spot Blasting",
    aliases: [
      "spot blast", "spot blasting", "spot blast cleaning",
      "spot abrasive blasting", "spot grit blasting", "localised blasting",
    ],
  },
  {
    id: "full-blasting",
    name: "Full Blasting",
    aliases: [
      "full blast", "full blasting", "full grit blasting", "complete blasting",
      "overall blasting", "full abrasive blasting",
    ],
  },
  {
    id: "sa1",
    name: "SA 1 (Brush-off)",
    aliases: [
      "sa1", "sa 1", "sa-1", "iso sa1", "sa 1.0", "sa1.0",
      "brush off blast", "brush-off", "light sweep",
    ],
  },
  {
    id: "sa1.5",
    name: "SA 1.5",
    aliases: ["sa1.5", "sa 1.5", "sa-1.5", "iso sa1.5"],
  },
  {
    id: "sa2",
    name: "SA 2 (Commercial)",
    aliases: [
      "sa2", "sa 2", "sa-2", "iso sa2", "sa 2.0", "sa2.0",
      "commercial blast", "commercial blasting",
    ],
  },
  {
    id: "sa2.5",
    name: "SA 2.5 (Near-white)",
    aliases: [
      "sa2.5", "sa 2.5", "sa-2.5", "iso sa2.5",
      "near white", "near-white blast", "near white metal",
    ],
  },
  {
    id: "sa3",
    name: "SA 3 (White Metal)",
    aliases: [
      "sa3", "sa 3", "sa-3", "iso sa3",
      "white metal", "white metal blast",
    ],
  },
  {
    id: "freshwater-wash",
    name: "Freshwater Wash",
    aliases: [
      "fresh water wash", "freshwater wash", "freshwater washing",
      "fw wash", "fresh water washing", "fresh water rinse",
      "fresh water cleaning", "fw cleaning",
    ],
  },
  {
    id: "hp-wash",
    name: "High Pressure Wash",
    aliases: [
      "high pressure wash", "high-pressure wash", "hp wash", "hpw",
      "high pressure washing", "hp washing", "high pressure water jetting",
      "hp water jetting", "uhp wash", "ultra high pressure",
      "hydro blasting", "hydroblasting", "water blasting",
    ],
  },
  {
    id: "air-drying",
    name: "Air Drying",
    aliases: [
      "air dry", "air drying", "air-drying", "forced drying",
      "dehumidification", "dehumidifying", "blow drying",
    ],
  },
  {
    id: "power-tool-cleaning",
    name: "Power Tool Cleaning",
    aliases: [
      "power tool", "power tool cleaning", "mechanical cleaning",
      "disc grinding", "needle gunning", "needle gun",
      "rotary tool", "power tool prep",
    ],
  },
  {
    id: "hand-tool-cleaning",
    name: "Hand Tool Cleaning",
    aliases: [
      "hand tool", "hand tool cleaning", "manual cleaning",
      "wire brush", "scraping", "hand scraping", "chipping",
    ],
  },
  {
    id: "hull-preparation",
    name: "Hull Preparation",
    aliases: [
      "hull prep", "hull preparation", "surface preparation",
      "surface prep", "prep for painting", "surface treatment",
    ],
  },
  {
    id: "primer-application",
    name: "Primer Application",
    aliases: [
      "primer", "primer application", "priming", "shop primer",
      "anticorrosive primer", "epoxy primer", "primer coat",
      "1st coat", "first coat",
    ],
  },
  {
    id: "antifouling",
    name: "Antifouling Application",
    aliases: [
      "antifouling", "anti-fouling", "af", "a/f",
      "antifouling paint", "bottom paint", "af application",
      "af coating", "antifouling coat",
    ],
  },
  {
    id: "topcoat",
    name: "Topcoat / Finish Coat",
    aliases: [
      "topcoat", "top coat", "finish coat", "final coat",
      "enamel coat", "finishing coat", "2nd coat",
    ],
  },
];

export const AREA_UNIT_PATTERN =
  /\b(m2|m²|sqm|sq\.?\s*m|square\s*m(?:eter)?s?)\b/i;

export const AREA_HEADER_KEYWORDS = [
  "area",
  "extent",
  "surface",
  "sqm",
  "m2",
  "m²",
  "square",
];

export const RATE_PER_SQM_KEYWORDS = [
  "rate/m2",
  "rate/m²",
  "rate per m2",
  "rate per sqm",
  "unit rate",
  "price/m2",
  "cost/m2",
  "/m2",
  "/m²",
  "per m2",
  "per sqm",
  "rate per sq m",
  "cost per sqm",
  "price per sqm",
];

/** Boot Top / Side Bottom zone combined alias (when LLL not provided). */
export const COMBINED_ZONE_ALIASES = [
  "side bottom & boottop",
  "side bottom and boottop",
  "boottop & side bottom",
  "underwater hull",
  "below waterline",
  "submerged hull",
];
