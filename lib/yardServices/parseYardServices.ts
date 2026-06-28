import {
  CONNECTION_SERVICES,
  CONNECT_DISCONNECT_LINE_PATTERN,
  ConnectionServiceDefinition,
  CPR_DAY_PATTERNS,
  CPR_DAYS_CONTEXT,
  DRY_DOCK_DAYS_CONTEXT,
  HEADER_SCAN_ROWS,
  MIN_UNITS_PATTERN,
  QUANTITY_IN_LABEL_PATTERN,
  ServiceDefinition,
  SHIFT_HOURS_PATTERN,
  SHIPYARD_DAYS_CONTEXT,
  TEMPORARY_EQUIPMENT_SERVICES,
  WATCH_SERVICES,
} from "@/lib/yardServices/constants";
import {
  buildVesselDuration,
  calculateConnectionDailyTotal,
  calculateConnectionServiceTotal,
  calculateConnectDisconnectTotal,
  calculateEquipmentServiceTotal,
  calculateWatchServiceTotal,
  dailyEquipmentCost,
  dailyWatchCost,
  effectiveUnits,
  personsFor24HourCoverage,
  sumNullable,
} from "@/lib/yardServices/calculate";
import type {
  ConnectionServiceLine,
  TemporaryEquipmentLine,
  VendorYardServicesQuote,
  WatchServiceLine,
} from "@/lib/yardServices/types";

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

function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const line = rowToStrings(rows[i] ?? []).join(" ").toLowerCase();
    const hits = ["description", "item", "service", "qty", "rate", "total", "amount"].filter(
      (k) => line.includes(k),
    ).length;
    if (hits >= 2) return i;
  }
  return -1;
}

function mapPriceColumns(header: string[]) {
  const lower = header.map((h) => h.toLowerCase());
  const find = (pred: (h: string) => boolean) => lower.findIndex(pred);

  const serviceCol = find((h) =>
    ["description", "item", "service", "scope", "particular", "activity"].some((k) =>
      h.includes(k),
    ),
  );
  const qtyCol = find((h) => h.includes("qty") || h.includes("quantity"));
  const unitCol = find((h) => h === "unit" || h.includes("uom"));
  const unitRateCol = find(
    (h) =>
      h.includes("unit rate") ||
      h.includes("unit price") ||
      (h.includes("rate") && !h.includes("total")),
  );
  const totalCol = find((h) =>
    ["total", "amount", "extended", "line total", "value"].some((k) => h.includes(k)),
  );

  return {
    serviceCol: serviceCol >= 0 ? serviceCol : 0,
    qtyCol,
    unitCol,
    unitRateCol,
    totalCol,
  };
}

function looksLikeDateRange(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bfrom\b/.test(lower) && /\bto\b/.test(lower)) return true;
  const dates = text.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g);
  return (dates?.length ?? 0) >= 2;
}

function extractDaysFromText(
  text: string,
  context: RegExp,
  patterns: RegExp[],
): number | undefined {
  if (!text || !context.test(text)) return undefined;
  if (looksLikeDateRange(text)) return undefined;

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseNumber(m[1]);
      if (n != null && n > 0 && n <= 365) return Math.round(n);
    }
  }
  return undefined;
}

const SHIPYARD_DAY_PATTERNS: RegExp[] = [
  /(?:no\.?\s*of\s*)?days?\s*(?:in\s*)?(?:the\s*)?shipyard\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /shipyard\s*(?:period|duration|days?|stay)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /(\d+(?:\.\d+)?)\s*days?\s*(?:in\s*)?(?:the\s*)?shipyard/i,
  /(?:yard|repair)\s*(?:period|duration)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*days?/i,
  /(?:period|duration)\s*(?:in\s*)?(?:the\s*)?shipyard\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
];

const DRY_DOCK_DAY_PATTERNS: RegExp[] = [
  /(?:no\.?\s*of\s*)?days?\s*(?:in\s*)?(?:the\s*)?dry\s*[- ]?\s*dock\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /dry\s*[- ]?\s*dock(?:ing)?\s*(?:period|duration|days?|stay)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /(\d+(?:\.\d+)?)\s*days?\s*(?:in\s*)?(?:the\s*)?dry\s*[- ]?\s*dock/i,
  /dry\s*[- ]?\s*dock\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*days?/i,
  /(?:dd|d\/d)\s*days?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  /(?:period|duration)\s*(?:in\s*)?dry\s*[- ]?\s*dock\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
];

interface DaysCandidate {
  days: number;
  source: string;
  priority: number;
}

function rowLooksLikePricedLineItem(
  row: unknown[],
  strings: string[],
  cols: ReturnType<typeof mapPriceColumns>,
): boolean {
  const numbers = row
    .map((c) => parseNumber(c))
    .filter((n): n is number => n !== undefined && n > 0);

  if (cols.totalCol >= 0 && parseNumber(row[cols.totalCol]) != null) return true;
  if (numbers.length >= 2 && strings[cols.serviceCol]?.length > 0) return true;
  return false;
}

function scanStatedDays(
  sheetName: string,
  rows: unknown[][],
  context: RegExp,
  patterns: RegExp[],
): DaysCandidate | null {
  const headerIdx = detectHeaderRow(rows);
  const summaryEnd =
    headerIdx >= 0 ? headerIdx : Math.min(rows.length, HEADER_SCAN_ROWS);

  const candidates: DaysCandidate[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const line = strings.filter(Boolean).join(" ");
    if (!line) continue;

    const days = extractDaysFromText(line, context, patterns);
    if (days == null) continue;

    const inSummary = r < summaryEnd;
    const priority = inSummary ? 0 : 1;

    if (!inSummary) {
      const header =
        headerIdx >= 0 ? rowToStrings(rows[headerIdx] ?? []) : [];
      const cols = header.length ? mapPriceColumns(header) : mapPriceColumns([]);
      if (rowLooksLikePricedLineItem(row, strings, cols)) continue;
    }

    candidates.push({
      days,
      source: `${sheetName} row ${r + 1}: ${line.slice(0, 120)}`,
      priority,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority || a.days - b.days);
  return candidates[0]!;
}

function matchServiceDefinition(
  label: string,
  definitions: ServiceDefinition[],
): ServiceDefinition | null {
  const lower = label.toLowerCase();
  for (const def of definitions) {
    if (def.aliases.some((alias) => lower.includes(alias))) return def;
  }
  return null;
}

function aliasMatches(label: string, alias: string): boolean {
  const lower = label.toLowerCase();
  const a = alias.toLowerCase();
  return lower.includes(a) || a.includes(lower);
}

function matchConnectionService(
  label: string,
): { service: ConnectionServiceDefinition; kind: "daily" | "connectDisconnect" } | null {
  const lower = label.toLowerCase();
  if (!lower) return null;

  for (const def of CONNECTION_SERVICES) {
    if (
      def.connectDisconnectAliases.some((alias) => aliasMatches(lower, alias)) ||
      (CONNECT_DISCONNECT_LINE_PATTERN.test(lower) &&
        def.dailyAliases.some((alias) => aliasMatches(lower, alias)))
    ) {
      return { service: def, kind: "connectDisconnect" };
    }
  }

  for (const def of CONNECTION_SERVICES) {
    if (def.dailyAliases.some((alias) => aliasMatches(lower, alias))) {
      if (CONNECT_DISCONNECT_LINE_PATTERN.test(lower)) {
        return { service: def, kind: "connectDisconnect" };
      }
      return { service: def, kind: "daily" };
    }
  }

  return null;
}

function parseConnectionCount(
  label: string,
  qty: number | undefined,
  defaultConnections: number,
): number {
  if (qty != null && qty > 0 && qty <= 50) return Math.round(qty);
  const inline = label.match(/(\d+)\s*(?:nos?|connections?|lines?|points?)\b/i);
  if (inline) {
    const n = parseNumber(inline[1]);
    if (n != null && n > 0 && n <= 50) return Math.round(n);
  }
  return defaultConnections;
}

function mergeConnectionLine(
  map: Map<string, ConnectionServiceLine>,
  partial: ConnectionServiceLine,
): void {
  const existing = map.get(partial.serviceId);
  const merged: ConnectionServiceLine = {
    serviceId: partial.serviceId,
    serviceName: partial.serviceName,
    connectionCount: partial.connectionCount || existing?.connectionCount || 1,
    ratePerConnectionPerDay:
      partial.ratePerConnectionPerDay ?? existing?.ratePerConnectionPerDay ?? null,
    rateConnectDisconnect:
      partial.rateConnectDisconnect ?? existing?.rateConnectDisconnect ?? null,
    connectDisconnectMultiplier:
      partial.connectDisconnectMultiplier ??
      existing?.connectDisconnectMultiplier ??
      2,
    serviceDays: partial.serviceDays ?? existing?.serviceDays ?? null,
    dailyTotal: null,
    connectDisconnectTotal: null,
    calculatedTotal: null,
    quotedTotal: partial.quotedTotal ?? existing?.quotedTotal ?? null,
    originalLabel: partial.originalLabel || existing?.originalLabel || partial.serviceName,
    sheetName: partial.sheetName,
    rowIndex: partial.rowIndex,
  };

  if (
    merged.ratePerConnectionPerDay != null &&
    merged.serviceDays != null &&
    merged.serviceDays > 0
  ) {
    merged.dailyTotal = calculateConnectionDailyTotal(
      merged.ratePerConnectionPerDay,
      merged.connectionCount,
      merged.serviceDays,
    );
  }

  if (merged.rateConnectDisconnect != null) {
    merged.connectDisconnectTotal = calculateConnectDisconnectTotal(
      merged.rateConnectDisconnect,
      merged.connectionCount,
      merged.connectDisconnectMultiplier,
    );
  }

  merged.calculatedTotal = calculateConnectionServiceTotal(
    merged.ratePerConnectionPerDay,
    merged.rateConnectDisconnect,
    merged.connectionCount,
    merged.serviceDays,
    merged.connectDisconnectMultiplier,
  );

  map.set(partial.serviceId, merged);
}

function parseMinimumUnits(text: string): number | undefined {
  const m = text.match(MIN_UNITS_PATTERN);
  if (!m) return undefined;
  return parseNumber(m[1] ?? m[2]);
}

function parseQuantityFromLabel(text: string): number | undefined {
  const m = text.match(QUANTITY_IN_LABEL_PATTERN);
  if (!m) return undefined;
  return parseNumber(m[1]);
}

function parseShiftHours(text: string): number {
  const m = text.match(SHIFT_HOURS_PATTERN);
  if (!m) return 8;
  const h = parseNumber(m[1]);
  if (h == null || h <= 0 || h > 24) return 8;
  return h;
}

function extractRowNumbers(
  row: unknown[],
  cols: ReturnType<typeof mapPriceColumns>,
): { unitRate?: number; quotedTotal?: number; qty?: number } {
  let unitRate =
    cols.unitRateCol >= 0 ? parseNumber(row[cols.unitRateCol]) : undefined;
  let quotedTotal =
    cols.totalCol >= 0 ? parseNumber(row[cols.totalCol]) : undefined;
  const qty = cols.qtyCol >= 0 ? parseNumber(row[cols.qtyCol]) : undefined;

  const numbers = row
    .map((c) => parseNumber(c))
    .filter((n): n is number => n !== undefined && n > 0);

  if (unitRate == null && numbers.length >= 1) {
    if (numbers.length === 1) {
      if (numbers[0]! < 500_000) unitRate = numbers[0];
      else quotedTotal = numbers[0];
    } else {
      unitRate = numbers[numbers.length - 2];
      quotedTotal = numbers[numbers.length - 1];
    }
  }

  return { unitRate, quotedTotal, qty };
}

function scanWatchServices(
  sheetName: string,
  rows: unknown[][],
  serviceDays: number | null,
): WatchServiceLine[] {
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx < 0) return [];

  const header = rowToStrings(rows[headerIdx] ?? []);
  const cols = mapPriceColumns(header);
  const lines: WatchServiceLine[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const label = strings[cols.serviceCol] || strings.filter(Boolean).join(" ");
    if (!label) continue;

    const def = matchServiceDefinition(label, WATCH_SERVICES);
    if (!def) continue;

    const unitHint =
      (cols.unitCol >= 0 ? strings[cols.unitCol] : "") || strings.join(" ");
    const { unitRate, quotedTotal } = extractRowNumbers(row, cols);
    if (unitRate == null) continue;

    const shiftHours = parseShiftHours(`${label} ${unitHint}`);
    const personsPerDay = personsFor24HourCoverage(shiftHours);
    const dailyCost = dailyWatchCost(unitRate, shiftHours);
    const calculatedTotal =
      serviceDays != null
        ? calculateWatchServiceTotal(unitRate, serviceDays, shiftHours)
        : null;

    lines.push({
      serviceId: def.id,
      serviceName: def.name,
      ratePerPersonPerDay: unitRate,
      shiftHours,
      personsPerDay,
      dailyCost,
      serviceDays,
      calculatedTotal,
      quotedTotal: quotedTotal ?? null,
      originalLabel: label,
      sheetName,
      rowIndex: r + 1,
    });
  }

  return lines;
}

function scanTemporaryEquipment(
  sheetName: string,
  rows: unknown[][],
  serviceDays: number | null,
): TemporaryEquipmentLine[] {
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx < 0) return [];

  const header = rowToStrings(rows[headerIdx] ?? []);
  const cols = mapPriceColumns(header);
  const lines: TemporaryEquipmentLine[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const label = strings[cols.serviceCol] || strings.filter(Boolean).join(" ");
    if (!label) continue;

    const def = matchServiceDefinition(label, TEMPORARY_EQUIPMENT_SERVICES);
    if (!def) continue;

    const unitHint =
      (cols.unitCol >= 0 ? strings[cols.unitCol] : "") || strings.join(" ");
    const combined = `${label} ${unitHint}`;

    const { unitRate, quotedTotal, qty } = extractRowNumbers(row, cols);
    if (unitRate == null) continue;

    const minimumUnits = parseMinimumUnits(combined) ?? null;
    const quotedQuantity =
      qty ?? parseQuantityFromLabel(combined) ?? null;
    const units = effectiveUnits(quotedQuantity, minimumUnits);
    const daily = dailyEquipmentCost(unitRate, units);
    const calculatedTotal =
      serviceDays != null
        ? calculateEquipmentServiceTotal(unitRate, units, serviceDays)
        : null;

    lines.push({
      serviceId: def.id,
      serviceName: def.name,
      ratePerUnitPerDay: unitRate,
      quotedQuantity,
      minimumUnits,
      effectiveUnits: units,
      serviceDays,
      dailyCost: daily,
      calculatedTotal,
      quotedTotal: quotedTotal ?? null,
      originalLabel: label,
      sheetName,
      rowIndex: r + 1,
    });
  }

  return lines;
}

function scanConnectionServices(
  sheetName: string,
  rows: unknown[][],
  serviceDays: number | null,
): ConnectionServiceLine[] {
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx < 0) return [];

  const header = rowToStrings(rows[headerIdx] ?? []);
  const cols = mapPriceColumns(header);
  const byService = new Map<string, ConnectionServiceLine>();

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const label = strings[cols.serviceCol] || strings.filter(Boolean).join(" ");
    if (!label) continue;

    const hit = matchConnectionService(label);
    if (!hit) continue;

    const { service, kind } = hit;
    const { unitRate, quotedTotal, qty } = extractRowNumbers(row, cols);
    if (unitRate == null) continue;

    const connectionCount = parseConnectionCount(label, qty, service.defaultConnections);

    if (kind === "daily") {
      mergeConnectionLine(byService, {
        serviceId: service.id,
        serviceName: service.name,
        connectionCount,
        ratePerConnectionPerDay: unitRate,
        rateConnectDisconnect: null,
        connectDisconnectMultiplier: service.connectDisconnectMultiplier,
        serviceDays,
        dailyTotal: null,
        connectDisconnectTotal: null,
        calculatedTotal: null,
        quotedTotal: quotedTotal ?? null,
        originalLabel: label,
        sheetName,
        rowIndex: r + 1,
      });
      continue;
    }

    mergeConnectionLine(byService, {
      serviceId: service.id,
      serviceName: service.name,
      connectionCount,
      ratePerConnectionPerDay: null,
      rateConnectDisconnect: unitRate,
      connectDisconnectMultiplier: service.connectDisconnectMultiplier,
      serviceDays,
      dailyTotal: null,
      connectDisconnectTotal: null,
      calculatedTotal: null,
      quotedTotal: quotedTotal ?? null,
      originalLabel: label,
      sheetName,
      rowIndex: r + 1,
    });
  }

  return Array.from(byService.values());
}

function dedupeBestLine<T extends { serviceId: string; calculatedTotal: number | null }>(
  lines: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const line of lines) {
    const existing = byId.get(line.serviceId);
    if (!existing) {
      byId.set(line.serviceId, line);
      continue;
    }
    const existingTotal = existing.calculatedTotal ?? 0;
    const nextTotal = line.calculatedTotal ?? 0;
    if (nextTotal > existingTotal) byId.set(line.serviceId, line);
  }
  return Array.from(byId.values());
}

export function parseYardServicesFromRows(
  vendorName: string,
  fileName: string,
  sheets: { name: string; rows: unknown[][] }[],
): VendorYardServicesQuote {
  const warnings: string[] = [];
  let shipyardDays: number | null = null;
  let shipyardDaysSource: string | null = null;
  let dryDockDays: number | null = null;
  let dryDockDaysSource: string | null = null;
  let cprDays: number | null = null;
  let cprDaysSource: string | null = null;

  for (const sheet of sheets) {
    if (shipyardDays == null) {
      const hit = scanStatedDays(
        sheet.name,
        sheet.rows,
        SHIPYARD_DAYS_CONTEXT,
        SHIPYARD_DAY_PATTERNS,
      );
      if (hit) {
        shipyardDays = hit.days;
        shipyardDaysSource = hit.source;
      }
    }
    if (dryDockDays == null) {
      const hit = scanStatedDays(
        sheet.name,
        sheet.rows,
        DRY_DOCK_DAYS_CONTEXT,
        DRY_DOCK_DAY_PATTERNS,
      );
      if (hit) {
        dryDockDays = hit.days;
        dryDockDaysSource = hit.source;
      }
    }
    if (cprDays == null) {
      const hit = scanStatedDays(
        sheet.name,
        sheet.rows,
        CPR_DAYS_CONTEXT,
        CPR_DAY_PATTERNS,
      );
      if (hit) {
        cprDays = hit.days;
        cprDaysSource = hit.source;
      }
    }
  }

  const duration = buildVesselDuration(
    shipyardDays,
    shipyardDaysSource,
    dryDockDays,
    dryDockDaysSource,
    cprDays,
    cprDaysSource,
  );

  if (duration.totalServiceDays == null) {
    warnings.push(
      "Could not find stated shipyard or dry-dock days in the header/summary — watch and equipment totals need a day count.",
    );
  }
  if (duration.connectionDays == null) {
    warnings.push(
      "Could not find CPR / shipyard stay days — connection daily charges need a day count.",
    );
  }

  const watchAll: WatchServiceLine[] = [];
  const equipmentAll: TemporaryEquipmentLine[] = [];
  const connectionAll: ConnectionServiceLine[] = [];

  for (const sheet of sheets) {
    watchAll.push(
      ...scanWatchServices(sheet.name, sheet.rows, duration.totalServiceDays),
    );
    equipmentAll.push(
      ...scanTemporaryEquipment(sheet.name, sheet.rows, duration.totalServiceDays),
    );
    connectionAll.push(
      ...scanConnectionServices(sheet.name, sheet.rows, duration.connectionDays),
    );
  }

  const watchServices = dedupeBestLine(watchAll);
  const temporaryEquipment = dedupeBestLine(equipmentAll);
  const connectionById = new Map<string, ConnectionServiceLine>();
  for (const line of connectionAll) mergeConnectionLine(connectionById, line);
  const connectionServices = Array.from(connectionById.values());

  if (watchServices.length === 0) {
    warnings.push(
      "No fireman watch or security patrol line items found with a per-person rate.",
    );
  }

  if (temporaryEquipment.length === 0) {
    warnings.push(
      "No temporary ventilation, exhaust fan, or temporary lighting line items found with a per-unit rate.",
    );
  }

  if (connectionServices.length === 0) {
    warnings.push(
      "No cooling water / shore utility connection line items found.",
    );
  }

  for (const line of temporaryEquipment) {
    if (line.minimumUnits != null && line.quotedQuantity != null) {
      if (line.effectiveUnits === line.minimumUnits && line.quotedQuantity < line.minimumUnits) {
        warnings.push(
          `${line.serviceName}: billed at minimum ${line.minimumUnits} unit(s) (quoted qty ${line.quotedQuantity}).`,
        );
      }
    }
  }

  const watchGrandTotal = sumNullable(
    watchServices.map((l) => l.calculatedTotal),
  );
  const equipmentGrandTotal = sumNullable(
    temporaryEquipment.map((l) => l.calculatedTotal),
  );
  const connectionGrandTotal = sumNullable(
    connectionServices.map((l) => l.calculatedTotal),
  );
  const grandTotal = sumNullable([
    watchGrandTotal,
    equipmentGrandTotal,
    connectionGrandTotal,
  ]);

  return {
    vendorName,
    fileName,
    duration,
    watchServices,
    temporaryEquipment,
    connectionServices,
    watchGrandTotal,
    equipmentGrandTotal,
    connectionGrandTotal,
    grandTotal,
    warnings,
  };
}
