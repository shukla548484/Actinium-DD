import type { HullFactorType, VesselParticulars } from "@/lib/hull/calculateAreas";
import { inferHullFactorFromDeadweight } from "@/lib/hull/calculateAreas";

const FIELD_PATTERNS: {
  key: keyof VesselParticulars;
  patterns: RegExp[];
}[] = [
  {
    key: "loa",
    patterns: [
      /^loa$/i,
      /length\s*overall/i,
      /l\.?\s*o\.?\s*a\.?/i,
      /^length\s*\(loa\)/i,
    ],
  },
  {
    key: "lbp",
    patterns: [
      /^lbp$/i,
      /length\s*between\s*perpendiculars/i,
      /l\.?\s*b\.?\s*p\.?/i,
    ],
  },
  {
    key: "breadth",
    patterns: [/^breadth$/i, /^beam$/i, /^b\.?$/i, /moulded\s*breadth/i, /width/i],
  },
  {
    key: "depth",
    patterns: [/^depth$/i, /^d\.?$/i, /moulded\s*depth/i],
  },
  {
    key: "draught",
    patterns: [/^draught$/i, /^draft$/i, /^t\.?$/i, /summer\s*draught/i],
  },
  {
    key: "lll",
    patterns: [/^lll$/i, /light\s*load\s*line/i, /l\.?\s*l\.?\s*l\.?/i],
  },
  {
    key: "deadweight",
    patterns: [/^dw$/i, /^dwt$/i, /deadweight/i, /dead\s*weight/i],
  },
];

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const text = cellText(value).replace(/[,$\s]/g, "");
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function labelMatches(label: string, patterns: RegExp[]): boolean {
  const norm = label.toLowerCase().replace(/\s+/g, " ").trim();
  return patterns.some((p) => p.test(norm) || p.test(label));
}

function assignField(
  particulars: VesselParticulars,
  key: keyof VesselParticulars,
  value: number,
  source: string,
) {
  if (key === "hullFactorType" || key === "source") return;
  const existing = particulars[key];
  if (existing == null && value > 0) {
    (particulars as Record<string, unknown>)[key] = value;
    if (!particulars.source) particulars.source = source;
  }
}

export function extractVesselParticularsFromRows(
  sheets: { name: string; rows: unknown[][] }[],
): VesselParticulars {
  const particulars: VesselParticulars = {};

  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, 80); r++) {
      const row = sheet.rows[r] ?? [];
      const cells = row.map(cellText);

      for (let c = 0; c < cells.length - 1; c++) {
        const label = cells[c];
        if (!label || label.length > 60) continue;

        for (const field of FIELD_PATTERNS) {
          if (!labelMatches(label, field.patterns)) continue;
          for (let v = c + 1; v < Math.min(c + 4, cells.length); v++) {
            const num = parseNumber(row[v]);
            if (num != null && num > 0) {
              assignField(
                particulars,
                field.key,
                num,
                `${sheet.name} row ${r + 1}`,
              );
              break;
            }
          }
        }
      }

      const line = cells.join(" ").toLowerCase();
      if (/motorship|motor ship/.test(line) && !particulars.hullFactorType) {
        particulars.hullFactorType = "motorship";
      }
      if (/bulker|tanker|bulk carrier/.test(line) && !particulars.hullFactorType) {
        if (particulars.deadweight) {
          particulars.hullFactorType = inferHullFactorFromDeadweight(
            particulars.deadweight,
          );
        }
      }
    }
  }

  if (!particulars.hullFactorType && particulars.deadweight) {
    particulars.hullFactorType = inferHullFactorFromDeadweight(particulars.deadweight);
  }

  return particulars;
}

export function mergeParticulars(
  fromSheet: VesselParticulars,
  manual: VesselParticulars,
): VesselParticulars {
  return {
    loa: manual.loa ?? fromSheet.loa,
    lbp: manual.lbp ?? fromSheet.lbp,
    breadth: manual.breadth ?? fromSheet.breadth,
    depth: manual.depth ?? fromSheet.depth,
    draught: manual.draught ?? fromSheet.draught,
    lll: manual.lll ?? fromSheet.lll,
    deadweight: manual.deadweight ?? fromSheet.deadweight,
    hullFactorType: manual.hullFactorType ?? fromSheet.hullFactorType,
    source: manual.loa ? "Manual entry" : fromSheet.source,
  };
}

export function particularsComplete(p: VesselParticulars): boolean {
  return Boolean(p.loa && p.lbp && p.breadth && p.depth && p.draught != null);
}

export function missingParticularFields(p: VesselParticulars): string[] {
  const missing: string[] = [];
  if (!p.loa) missing.push("LOA");
  if (!p.lbp) missing.push("LBP");
  if (!p.breadth) missing.push("Breadth");
  if (!p.depth) missing.push("Depth");
  if (p.draught == null) missing.push("Draught");
  return missing;
}
