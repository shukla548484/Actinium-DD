export interface ServiceDefinition {
  id: string;
  name: string;
  aliases: string[];
}

/** Per-person watch / patrol services billed on the same day-count basis. */
export const WATCH_SERVICES: ServiceDefinition[] = [
  {
    id: "fireman-watch",
    name: "Fireman watch",
    aliases: [
      "fireman watch",
      "fire watch",
      "fireman",
      "fire safety watch",
      "fire patrol",
      "fire guard",
    ],
  },
  {
    id: "security-patrol",
    name: "Security patrol",
    aliases: [
      "security patrol",
      "security watch",
      "yard security",
      "security guard",
      "watchman",
      "guard patrol",
      "night watch",
    ],
  },
];

/** Temporary hire equipment billed per unit per day (ventilation, lighting, etc.). */
export const TEMPORARY_EQUIPMENT_SERVICES: ServiceDefinition[] = [
  {
    id: "temporary-ventilation",
    name: "Temporary ventilation",
    aliases: [
      "temporary ventilation",
      "temp ventilation",
      "ventilation fan",
      "ventilation blower",
      "portable ventilation",
      "temporary vent",
      "yard ventilation",
    ],
  },
  {
    id: "exhaust-fan",
    name: "Exhaust fan",
    aliases: [
      "exhaust fan",
      "exhaust blower",
      "extractor fan",
      "fume exhaust",
      "portable exhaust",
      "temporary exhaust",
    ],
  },
  {
    id: "temporary-lighting",
    name: "Temporary lighting",
    aliases: [
      "temporary lighting",
      "temp lighting",
      "temporary light",
      "portable lighting",
      "yard lighting",
      "flood light",
      "floodlight",
      "work light",
      "temporary lamp",
    ],
  },
];

export interface ConnectionServiceDefinition {
  id: string;
  name: string;
  dailyAliases: string[];
  connectDisconnectAliases: string[];
  defaultConnections: number;
  /** 2 = connect + disconnect; 3 = connect + interim + disconnect. */
  connectDisconnectMultiplier: number;
}

/**
 * Utility lines billed per connection per day for CPR stay, plus hookup fees.
 * Daily = $/connection/day × connections × CPR days.
 * Hookup = connect/disconnect rate × multiplier × connections.
 */
export const CONNECTION_SERVICES: ConnectionServiceDefinition[] = [
  {
    id: "cooling-water",
    name: "Cooling water line",
    dailyAliases: [
      "cooling water",
      "cooling water line",
      "cooling water supply",
      "cw line",
      "cooling line",
    ],
    connectDisconnectAliases: [
      "cooling water connect",
      "cooling water disconnect",
      "cooling water connect/disconnect",
      "cooling water connection/disconnection",
      "cw connect",
      "cw connect/disconnect",
    ],
    defaultConnections: 5,
    connectDisconnectMultiplier: 2,
  },
  {
    id: "shore-power",
    name: "Shore power / electrical",
    dailyAliases: [
      "shore power",
      "shore electrical",
      "electrical shore connection",
      "shore supply",
    ],
    connectDisconnectAliases: [
      "shore power connect",
      "electrical connect/disconnect",
      "power connect/disconnect",
      "shore power connection/disconnection",
    ],
    defaultConnections: 2,
    connectDisconnectMultiplier: 2,
  },
  {
    id: "compressed-air",
    name: "Compressed air",
    dailyAliases: [
      "compressed air",
      "air supply",
      "shop air",
      "compressed air line",
    ],
    connectDisconnectAliases: [
      "compressed air connect",
      "air connect/disconnect",
      "compressed air connection/disconnection",
    ],
    defaultConnections: 2,
    connectDisconnectMultiplier: 2,
  },
  {
    id: "fresh-water",
    name: "Fresh water line",
    dailyAliases: [
      "fresh water",
      "fresh water line",
      "fresh water supply",
      "fw line",
    ],
    connectDisconnectAliases: [
      "fresh water connect",
      "fresh water connect/disconnect",
      "fw connect/disconnect",
    ],
    defaultConnections: 2,
    connectDisconnectMultiplier: 2,
  },
];

export const DEFAULT_COOLING_WATER_CONNECTIONS = 5;

/** CPR / common repair period — duration for per-day connection charges. */
export const CPR_DAYS_CONTEXT =
  /\bcpr\b|common\s*period(?:\s*of\s*repair)?|vessel\s*stay|stay\s*in\s*(?:cpr|yard)|period\s*in\s*cpr/i;

export const CPR_DAY_PATTERNS: RegExp[] = [
  /(?:no\.?\s*of\s*)?days?\s*(?:in\s*)?cpr\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /cpr\s*(?:period|duration|days?|stay)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /(\d+(?:\.\d+)?)\s*days?\s*(?:in\s*)?cpr/i,
  /(?:vessel|repair)\s*stay\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*days?/i,
  /(?:period|duration)\s*(?:in\s*)?cpr\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
];

export const CONNECT_DISCONNECT_LINE_PATTERN =
  /\b(connect\s*\/\s*disconnect|connection\s*\/\s*disconnection|hook\s*up|hookup|connect\s*and\s*disconnect)\b/i;

/** Must appear near a day count for it to count as stated shipyard days. */
export const SHIPYARD_DAYS_CONTEXT =
  /shipyard|in\s*(?:the\s*)?yard|yard\s*period|repair\s*period|at\s*yard|yard\s*stay|days\s*in\s*yard|period\s*in\s*yard/i;

/** Re-export dry-dock day context for vessel duration. */
export { DRY_DOCK_DAYS_CONTEXT } from "@/lib/dryDock/constants";

export const DEFAULT_SHIFT_HOURS = 8;
export const HOURS_PER_DAY = 24;

export const HEADER_SCAN_ROWS = 60;

export const PER_DAY_UNIT_PATTERN =
  /\b(day|days|per\s*day|\/\s*day|pd|p\.?d\.?)\b/i;

export const PER_PERSON_RATE_PATTERN =
  /\b(per\s*(?:person|man|shift|watchman|guard)|\/\s*(?:person|man|shift)|p\.?\s*p\.?|per\s*day\s*per\s*(?:person|man))\b/i;

export const PER_UNIT_RATE_PATTERN =
  /\b(per\s*(?:unit|set|pc|nos?|no\.|piece|fan|light|lamp)|\/\s*(?:unit|set|pc|nos?|fan|light)|p\.?\s*u\.?)\b/i;

export const SHIFT_HOURS_PATTERN = /(\d+)\s*(?:hours?|hrs?|h\b)/i;

export const MIN_UNITS_PATTERN =
  /\bmin(?:imum)?\.?\s*(\d+(?:\.\d+)?)\s*(?:nos?|no\.|units?|sets?|pcs?|fans?|lights?|lamps?)?\b|\b(\d+(?:\.\d+)?)\s*(?:nos?|units?|sets?|pcs?)\s*min(?:imum)?\b/i;

export const QUANTITY_IN_LABEL_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(?:nos?|no\.|units?|sets?|pcs?|fans?|lights?|lamps?)\b/i;
