import {
  AREA_HEADER_KEYWORDS,
  AREA_UNIT_PATTERN,
  HULL_ZONES,
  PREP_SERVICES,
  RATE_PER_SQM_KEYWORDS,
} from "@/lib/hull/constants";
import type {
  HullPrepLineItem,
  HullZoneArea,
  HullZoneDefinition,
  PrepServiceDefinition,
  VendorHullPaintQuote,
} from "@/lib/hull/types";

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

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchDefinition<T extends { id: string; name: string; aliases: string[] }>(
  text: string,
  definitions: T[],
): T | null {
  const norm = normalize(text);
  if (!norm) return null;

  let best: { def: T; score: number } | null = null;

  for (const def of definitions) {
    const candidates = [def.name, ...def.aliases].map(normalize);
    for (const c of candidates) {
      if (norm === c) {
        return def;
      }
      if (norm.includes(c) || c.includes(norm)) {
        const score = c.length;
        if (!best || score > best.score) {
          best = { def, score };
        }
      }
    }
  }

  return best?.def ?? null;
}

function extractAreaFromText(text: string): number | undefined {
  const match = text.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.?\s*m|square\s*m(?:eter)?s?)/i,
  );
  if (match) return parseNumber(match[1]);

  const bare = text.match(/\barea\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (bare) return parseNumber(bare[1]);

  return undefined;
}

function isAreaHeader(header: string): boolean {
  const h = header.toLowerCase();
  return AREA_HEADER_KEYWORDS.some((k) => h.includes(k));
}

function isRatePerSqmHeader(header: string): boolean {
  const h = header.toLowerCase();
  return RATE_PER_SQM_KEYWORDS.some((k) => h.includes(k));
}

function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const line = rowToStrings(rows[i] ?? []).join(" ").toLowerCase();
    const hits = ["description", "item", "service", "area", "rate", "total", "qty"].filter(
      (k) => line.includes(k),
    ).length;
    if (hits >= 2) return i;
  }
  return -1;
}

function mapHullColumns(header: string[]) {
  const lower = header.map((h) => h.toLowerCase());
  const find = (pred: (h: string) => boolean) => lower.findIndex(pred);

  const serviceCol = find((h) =>
    ["description", "item", "service", "scope", "work", "activity", "particular"].some(
      (k) => h.includes(k),
    ),
  );
  const areaCol = find((h) => isAreaHeader(h));
  const qtyCol = find((h) => h.includes("qty") || h.includes("quantity"));
  const unitRateCol = find((h) => isRatePerSqmHeader(h) || h === "rate" || h.includes("unit rate"));
  const unitPriceCol = find(
    (h) =>
      (h.includes("unit") && (h.includes("price") || h.includes("rate"))) ||
      h === "unit price",
  );
  const totalCol = find((h) =>
    ["total", "amount", "extended", "line total", "value"].some((k) => h.includes(k)),
  );

  return {
    serviceCol: serviceCol >= 0 ? serviceCol : 0,
    areaCol,
    qtyCol,
    unitRateCol: unitRateCol >= 0 ? unitRateCol : unitPriceCol,
    totalCol,
  };
}

function scanZoneAreasFromSheet(
  sheetName: string,
  rows: unknown[][],
): HullZoneArea[] {
  const found: HullZoneArea[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const line = strings.filter(Boolean).join(" ");
    if (!line) continue;

    const zone = matchDefinition(line, HULL_ZONES);
    if (!zone) continue;

    let area: number | undefined;

    area = extractAreaFromText(line);

    if (area == null) {
      for (const cell of strings) {
        area = extractAreaFromText(cell);
        if (area != null) break;
      }
    }

    if (area == null) {
      const nums = row
        .map((c) => parseNumber(c))
        .filter((n): n is number => n !== undefined && n > 0 && n < 50000);
      if (nums.length === 1) area = nums[0];
      else if (nums.length >= 2) {
        const plausible = nums.filter((n) => n >= 10 && n <= 20000);
        if (plausible.length === 1) area = plausible[0];
      }
    }

    if (area != null && area > 0 && !seen.has(zone.id)) {
      seen.add(zone.id);
      found.push({
        zoneId: zone.id,
        zoneName: zone.name,
        areaSqm: area,
        source: `${sheetName} row ${r + 1}`,
      });
    }
  }

  return found;
}

function resolveAreaForRow(
  row: unknown[],
  strings: string[],
  cols: ReturnType<typeof mapHullColumns>,
  currentZone: HullZoneDefinition | null,
  zoneAreaMap: Map<string, number>,
): number | undefined {
  if (cols.areaCol >= 0) {
    const a = parseNumber(row[cols.areaCol]);
    if (a != null && a > 0) return a;
  }

  if (cols.qtyCol >= 0) {
    const headerHint = strings.join(" ");
    const qty = parseNumber(row[cols.qtyCol]);
    if (qty != null && qty > 0) {
      const unitCell = strings[cols.qtyCol + 1] ?? "";
      if (AREA_UNIT_PATTERN.test(unitCell) || AREA_UNIT_PATTERN.test(headerHint)) {
        return qty;
      }
      if (qty >= 10 && qty <= 20000) return qty;
    }
  }

  for (const cell of strings) {
    const fromText = extractAreaFromText(cell);
    if (fromText != null) return fromText;
  }

  if (currentZone) {
    const fromMap = zoneAreaMap.get(currentZone.id);
    if (fromMap != null) return fromMap;
  }

  return undefined;
}

function extractHullFromSheet(
  sheetName: string,
  rows: unknown[][],
  zoneAreas: HullZoneArea[],
): HullPrepLineItem[] {
  const items: HullPrepLineItem[] = [];
  const headerIdx = detectHeaderRow(rows);
  let cols = {
    serviceCol: 0,
    areaCol: -1,
    qtyCol: -1,
    unitRateCol: -1,
    totalCol: -1,
  };
  let startRow = 0;
  let currentZone: HullZoneDefinition | null = null;

  const zoneAreaMap = new Map<string, number>();
  for (const z of zoneAreas) {
    if (!zoneAreaMap.has(z.zoneId)) zoneAreaMap.set(z.zoneId, z.areaSqm);
  }

  if (headerIdx >= 0) {
    const header = rowToStrings(rows[headerIdx] ?? []);
    cols = mapHullColumns(header);
    startRow = headerIdx + 1;
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const numbers = row
      .map((c) => parseNumber(c))
      .filter((n): n is number => n !== undefined);

    if (strings.every((s) => !s)) continue;

    const line = strings.filter(Boolean).join(" ");
    const zoneMatch = matchDefinition(line, HULL_ZONES);
    if (zoneMatch && numbers.length <= 2) {
      currentZone = zoneMatch;
      const inlineArea = extractAreaFromText(line) ?? numbers.find((n) => n >= 10);
      if (inlineArea != null && inlineArea > 0) {
        zoneAreaMap.set(zoneMatch.id, inlineArea);
      }
      continue;
    }

    const serviceMatch = matchDefinition(line, PREP_SERVICES);
    if (!serviceMatch && !currentZone) continue;

    const service =
      serviceMatch ??
      matchDefinition(strings[cols.serviceCol] ?? line, PREP_SERVICES);
    if (!service) continue;

    const zone =
      currentZone ??
      matchDefinition(line, HULL_ZONES) ??
      (currentZone as HullZoneDefinition | null);

    if (!zone && !currentZone) {
      const catZone = zoneAreas.find((z) =>
        line.toLowerCase().includes(z.zoneName.toLowerCase()),
      );
      if (catZone) {
        currentZone =
          HULL_ZONES.find((z) => z.id === catZone.zoneId) ?? null;
      }
    }

    const activeZone = currentZone;
    if (!activeZone) continue;

    const areaSqm = resolveAreaForRow(row, strings, cols, activeZone, zoneAreaMap);
    if (areaSqm == null || areaSqm <= 0) continue;

    let unitRate =
      cols.unitRateCol >= 0 ? parseNumber(row[cols.unitRateCol]) : undefined;
    let quotedTotal =
      cols.totalCol >= 0 ? parseNumber(row[cols.totalCol]) : undefined;

    const priceLike = numbers.filter((n) => n > 0);
    if (unitRate == null && quotedTotal == null && priceLike.length >= 1) {
      if (priceLike.length === 1) {
        if (priceLike[0] < areaSqm) unitRate = priceLike[0];
        else quotedTotal = priceLike[0];
      } else {
        unitRate = priceLike[priceLike.length - 2];
        quotedTotal = priceLike[priceLike.length - 1];
      }
    }

    if (unitRate == null && quotedTotal != null && areaSqm > 0) {
      unitRate = quotedTotal / areaSqm;
    }

    if (unitRate == null) continue;

    const calculatedTotal = Math.round(areaSqm * unitRate * 100) / 100;

    items.push({
      zoneId: activeZone.id,
      zoneName: activeZone.name,
      serviceId: service.id,
      serviceName: service.name,
      areaSqm,
      unitRatePerSqm: unitRate,
      calculatedTotal,
      quotedTotal,
      originalLabel: strings[cols.serviceCol] || line,
      sheetName,
      rowIndex: r + 1,
    });
  }

  return items;
}

export function parseHullPaintFromRows(
  vendorName: string,
  fileName: string,
  sheets: { name: string; rows: unknown[][] }[],
): VendorHullPaintQuote {
  const zoneAreas: HullZoneArea[] = [];
  const lineItems: HullPrepLineItem[] = [];
  const zoneSeen = new Map<string, HullZoneArea>();

  for (const sheet of sheets) {
    for (const z of scanZoneAreasFromSheet(sheet.name, sheet.rows)) {
      if (!zoneSeen.has(z.zoneId)) {
        zoneSeen.set(z.zoneId, z);
        zoneAreas.push(z);
      }
    }
  }

  for (const sheet of sheets) {
    lineItems.push(...extractHullFromSheet(sheet.name, sheet.rows, zoneAreas));
  }

  for (const item of lineItems) {
    if (!zoneSeen.has(item.zoneId)) {
      const entry: HullZoneArea = {
        zoneId: item.zoneId,
        zoneName: item.zoneName,
        areaSqm: item.areaSqm,
        source: `${item.sheetName} row ${item.rowIndex} (from line item)`,
      };
      zoneSeen.set(item.zoneId, entry);
      zoneAreas.push(entry);
    }
  }

  return { vendorName, fileName, zoneAreas, lineItems };
}
