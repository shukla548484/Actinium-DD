import { DRY_DOCK_DAYS_CONTEXT, DRY_DOCK_HEADER_SCAN_ROWS, DRY_DOCK_RATE_EXCLUDE_KEYWORDS, DRY_DOCK_RATE_LABEL_KEYWORDS, PER_DAY_UNIT_PATTERN } from "@/lib/dryDock/constants";
import type { VendorDryDockQuote } from "@/lib/dryDock/types";

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

function rowToStrings(row: unknown[]): string[] {
  return row.map((c) => cellText(c));
}

function extractDaysFromText(text: string): number | undefined {
  const withUnit = text.match(/(\d+)\s*(?:days?|d\b)/i);
  if (withUnit) return parseNumber(withUnit[1]);
  const colon = text.match(/(?:days?|period|duration)\s*[:\-]\s*(\d+)/i);
  if (colon) return parseNumber(colon[1]);
  return undefined;
}

function scanDryDockDays(
  sheets: { name: string; rows: unknown[][] }[],
): { days: number; source: string } | null {
  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, DRY_DOCK_HEADER_SCAN_ROWS); r++) {
      const row = sheet.rows[r] ?? [];
      const strings = rowToStrings(row);
      const line = strings.filter(Boolean).join(" ");
      if (!line || !DRY_DOCK_DAYS_CONTEXT.test(line)) continue;

      const days = extractDaysFromText(line);
      if (days != null && days > 0 && days <= 365) {
        return { days, source: `${sheet.name} row ${r + 1}` };
      }

      for (let c = 0; c < strings.length; c++) {
        if (!DRY_DOCK_DAYS_CONTEXT.test(strings[c] ?? "")) continue;
        const adjacent = parseNumber(row[c + 1]);
        if (adjacent != null && adjacent > 0 && adjacent <= 365) {
          return { days: adjacent, source: `${sheet.name} row ${r + 1} col ${c + 2}` };
        }
      }
    }
  }
  return null;
}

function isDryDockRateLabel(label: string): boolean {
  const lower = label.toLowerCase();
  if (DRY_DOCK_RATE_EXCLUDE_KEYWORDS.some((k) => lower.includes(k))) return false;
  return DRY_DOCK_RATE_LABEL_KEYWORDS.some((k) => lower.includes(k));
}

function scanDryDockRate(
  sheets: { name: string; rows: unknown[][] }[],
): {
  dailyRatePerDay: number;
  rateSource: string;
  rateLineLabel: string;
  quotedTotal: number | null;
} | null {
  for (const sheet of sheets) {
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      const strings = rowToStrings(row);
      const line = strings.filter(Boolean).join(" ");
      if (!line || !isDryDockRateLabel(line)) continue;

      const numbers = row
        .map((c) => parseNumber(c))
        .filter((n): n is number => n !== undefined && n > 0);

      if (numbers.length === 0) continue;

      const perDay = PER_DAY_UNIT_PATTERN.test(line);
      let dailyRate = numbers[0];
      let quotedTotal: number | null = null;

      if (numbers.length >= 2) {
        dailyRate = numbers[numbers.length - 2];
        quotedTotal = numbers[numbers.length - 1];
      } else if (!perDay && numbers[0] > 5000) {
        continue;
      }

      if (dailyRate > 0 && dailyRate < 100000) {
        return {
          dailyRatePerDay: dailyRate,
          rateSource: `${sheet.name} row ${r + 1}`,
          rateLineLabel: strings[0] || line,
          quotedTotal,
        };
      }
    }
  }
  return null;
}

export function parseDryDockFromRows(
  vendorName: string,
  fileName: string,
  sheets: { name: string; rows: unknown[][] }[],
): VendorDryDockQuote {
  const warnings: string[] = [];
  const daysHit = scanDryDockDays(sheets);
  const rateHit = scanDryDockRate(sheets);

  const dryDockDays = daysHit?.days ?? null;
  const daysSource = daysHit?.source ?? null;
  const dailyRatePerDay = rateHit?.dailyRatePerDay ?? null;
  const rateSource = rateHit?.rateSource ?? null;
  const rateLineLabel = rateHit?.rateLineLabel ?? null;
  const quotedTotal = rateHit?.quotedTotal ?? null;

  let calculatedTotal: number | null = null;
  if (dryDockDays != null && dailyRatePerDay != null) {
    calculatedTotal = Math.round(dryDockDays * dailyRatePerDay * 100) / 100;
  }

  if (dryDockDays == null) {
    warnings.push(
      "Dry-dock days not found in sheet header — use the stated days in dry dock, not line-item qty.",
    );
  }
  if (dailyRatePerDay == null) {
    warnings.push("Dry-dock daily hire rate not found on a dockage / berth line item.");
  }

  return {
    vendorName,
    fileName,
    dryDockDays,
    daysSource,
    dailyRatePerDay,
    rateSource,
    rateLineLabel,
    calculatedTotal,
    quotedTotal,
    warnings,
  };
}
