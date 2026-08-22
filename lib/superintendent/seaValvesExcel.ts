import ExcelJS from "exceljs";
import type { DefectImportVesselContext } from "@/lib/superintendent/defectsExcel";
import {
  SEA_VALVE_GROUPS,
  SEA_VALVE_OVERHAUL_LOCATIONS,
  createSeaValveRow,
  parseSeaValveGroup,
  parseSeaValveOverhaulLocation,
  type SeaValveRow,
} from "@/lib/superintendent/seaValves";

export const SEA_VALVE_IMPORT_COLUMNS = {
  group: "Group",
  spec: "Specification / type",
  overhaulLocation: "Overhaul location",
  locationName: "Location / line name",
  notes: "Notes",
} as const;

const PHOTO_HEADER_KEYS = ["photo", "photos", "image", "images", "picture", "attachment", "attachments"];

const HEADER_ALIASES: Record<keyof typeof SEA_VALVE_IMPORT_COLUMNS, string[]> = {
  group: ["group", "valve group", "category"],
  spec: ["specification type", "specification", "spec", "valve type", "jis"],
  overhaulLocation: ["overhaul location", "overhaul", "in situ", "workshop"],
  locationName: ["location line name", "line name", "line"],
  notes: ["notes", "condition", "leakage", "remarks"],
};

function blank(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_/.-]+/g, " ").trim();
}

function isPhotoHeader(header: string): boolean {
  const n = normalizeHeader(header);
  return PHOTO_HEADER_KEYS.some((k) => n === k || n.includes(k));
}

function matchColumn(header: string): keyof typeof SEA_VALVE_IMPORT_COLUMNS | null {
  const n = normalizeHeader(header);
  if (!n || isPhotoHeader(n)) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof typeof SEA_VALVE_IMPORT_COLUMNS,
    string[],
  ][]) {
    if (aliases.some((alias) => n === alias || n.includes(alias))) return key;
  }
  return null;
}

export async function buildSeaValveImportTemplateWorkbook(
  ctx: DefectImportVesselContext,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Actinium DD";
  wb.created = new Date();

  const particulars = wb.addWorksheet("Vessel particulars", {
    views: [{ showGridLines: false }],
  });
  particulars.columns = [{ width: 32 }, { width: 56 }];

  particulars.mergeCells(1, 1, 1, 2);
  const title = particulars.getCell(1, 1);
  title.value = "Sea valve import template — vessel particulars (from database)";
  title.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
  title.alignment = { vertical: "middle" };
  particulars.getRow(1).height = 22;

  particulars.mergeCells(2, 1, 2, 2);
  const note = particulars.getCell(2, 1);
  note.value =
    "These fields are filled from the vessel and company records. Do not add photos to this workbook.";
  note.font = { italic: true, size: 10, color: { argb: "FF495057" } };
  note.alignment = { wrapText: true };
  particulars.getRow(2).height = 28;

  const hullNumber = ctx.hullNumber?.trim() || ctx.vesselCode;
  const rows: [string, string][] = [
    ["Vessel name", ctx.vesselName],
    ["IMO number", blank(ctx.imoNumber)],
    ["Hull / vessel code", hullNumber],
    ["Flag", blank(ctx.flag)],
    ["Class society", blank(ctx.classSociety)],
    ["Vessel type", blank(ctx.vesselType)],
    ["Call sign", blank(ctx.callSign)],
    ["Gross tonnage", ctx.grossTonnage != null ? String(ctx.grossTonnage) : ""],
    ["Year built", ctx.yearBuilt != null ? String(ctx.yearBuilt) : ""],
    ["Company name", ctx.companyName],
    ["Company code", ctx.companyCode],
    ["Company address", blank(ctx.companyAddress)],
    ["Company contact", blank(ctx.companyContactPerson)],
    ["Company email", blank(ctx.companyContactEmail)],
    ["Company phone", blank(ctx.companyContactPhone)],
    ["Dry dock project", ctx.projectName],
    ["Project code", blank(ctx.projectCode)],
  ];

  rows.forEach(([label, value], index) => {
    const r = index + 4;
    const labelCell = particulars.getCell(r, 1);
    const valueCell = particulars.getCell(r, 2);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { bold: true, size: 10 };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };
    labelCell.border = {
      top: { style: "thin", color: { argb: "FFCED4DA" } },
      bottom: { style: "thin", color: { argb: "FFCED4DA" } },
      left: { style: "thin", color: { argb: "FFCED4DA" } },
      right: { style: "thin", color: { argb: "FFCED4DA" } },
    };
    valueCell.border = labelCell.border;
    valueCell.protection = { locked: true };
  });
  particulars.protect("actinium-dd", { selectLockedCells: true, selectUnlockedCells: true });

  const valves = wb.addWorksheet("Sea valves");
  valves.columns = [{ width: 34 }, { width: 22 }, { width: 22 }, { width: 32 }, { width: 36 }];
  valves.mergeCells(1, 1, 1, 5);
  valves.getCell(1, 1).value =
    "Fill one row per valve. Group, specification / type, and overhaul location (in_situ or workshop) are required. Photos are not accepted in this Excel.";
  valves.getCell(1, 1).font = { italic: true, size: 10, color: { argb: "FF495057" } };
  valves.getCell(1, 1).alignment = { wrapText: true };
  valves.getRow(1).height = 32;

  const headers = [
    SEA_VALVE_IMPORT_COLUMNS.group,
    SEA_VALVE_IMPORT_COLUMNS.spec,
    SEA_VALVE_IMPORT_COLUMNS.overhaulLocation,
    SEA_VALVE_IMPORT_COLUMNS.locationName,
    SEA_VALVE_IMPORT_COLUMNS.notes,
  ];
  headers.forEach((header, i) => {
    const cell = valves.getCell(3, i + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  valves.getRow(3).height = 22;

  const sample = valves.getRow(4);
  sample.values = [
    SEA_VALVE_GROUPS[0]!.label,
    "5K20",
    "in_situ",
    "ME SW overboard P",
    "Example: slight weepage at packing",
  ];
  sample.font = { italic: true, color: { argb: "FF6C757D" } };

  for (let r = 5; r <= 54; r++) {
    for (let c = 1; c <= 5; c++) {
      const cell = valves.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFDEE2E6" } },
        bottom: { style: "thin", color: { argb: "FFDEE2E6" } },
        left: { style: "thin", color: { argb: "FFDEE2E6" } },
        right: { style: "thin", color: { argb: "FFDEE2E6" } },
      };
      cell.protection = { locked: false };
    }
  }

  const groupList = SEA_VALVE_GROUPS.map((g) => g.label).join(",");
  const overhaulList = `${SEA_VALVE_OVERHAUL_LOCATIONS.map((o) => o.value).join(",")},${SEA_VALVE_OVERHAUL_LOCATIONS.map((o) => o.label).join(",")}`;
  valves.dataValidations.add("A4:A54", {
    type: "list",
    allowBlank: true,
    formulae: [`"${groupList}"`],
    showErrorMessage: true,
    errorTitle: "Group",
    error: "Pick a valve group from the list.",
  });
  valves.dataValidations.add("C4:C54", {
    type: "list",
    allowBlank: true,
    formulae: [`"${overhaulList}"`],
    showErrorMessage: true,
    errorTitle: "Overhaul location",
    error: "Use in_situ or workshop.",
  });

  valves.views = [{ state: "frozen", ySplit: 3 }];

  const guide = wb.addWorksheet("Guide");
  guide.columns = [{ width: 96 }];
  const guideLines = [
    "How to use this template",
    "1. Leave Vessel particulars unchanged — they come from the vessel and company database.",
    "2. On the Sea valves sheet, add one row per overboard / sea valve.",
    "3. Required per row: Group, Specification / type, Overhaul location.",
    "4. Overhaul location must be in_situ (in place) or workshop.",
    "5. Optional: Location / line name (e.g. ME SW overboard P), Notes / leakage.",
    "6. Do not add photos, images, or attachment columns.",
    "7. Delete the example row before upload if you do not want it imported.",
    "8. Upload on the sea valves vessel input. Rows merge into this dry dock project until deleted.",
    `Groups: ${SEA_VALVE_GROUPS.map((g) => g.label).join("; ")}.`,
  ];
  guideLines.forEach((line, i) => {
    guide.getCell(i + 1, 1).value = line;
    guide.getCell(i + 1, 1).font = i === 0 ? { bold: true, size: 13 } : { size: 11 };
    guide.getRow(i + 1).height = 18;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((p) => p.text).join("").trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function findValvesSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const named = wb.worksheets.find((ws) => {
    const n = ws.name.toLowerCase();
    return n === "sea valves" || n === "valves" || n === "sea_valves";
  });
  if (named) return named;
  return (
    wb.worksheets.find((ws) => {
      const n = ws.name.toLowerCase();
      return n !== "guide" && n !== "vessel particulars" && n !== "vessel particulars (from database)";
    }) ?? null
  );
}

export async function parseSeaValveImportWorkbook(buffer: ArrayBuffer | Buffer): Promise<SeaValveRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const sheet = findValvesSheet(wb);
  if (!sheet) return [];

  let headerRow = 0;
  const colMap = new Map<number, keyof typeof SEA_VALVE_IMPORT_COLUMNS>();

  sheet.eachRow((row, rowNumber) => {
    if (headerRow > 0) return;
    const hits: Array<[number, keyof typeof SEA_VALVE_IMPORT_COLUMNS]> = [];
    row.eachCell((cell, colNumber) => {
      const mapped = matchColumn(cellText(cell.value));
      if (mapped) hits.push([colNumber, mapped]);
    });
    const keys = new Set(hits.map(([, k]) => k));
    if (keys.has("group") && keys.has("spec") && keys.has("overhaulLocation")) {
      headerRow = rowNumber;
      for (const [col, key] of hits) colMap.set(col, key);
    }
  });

  if (headerRow === 0) return [];

  const parsed: SeaValveRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Partial<Record<keyof typeof SEA_VALVE_IMPORT_COLUMNS, string>> = {};
    row.eachCell((cell, colNumber) => {
      const key = colMap.get(colNumber);
      if (!key) return;
      values[key] = cellText(cell.value);
    });

    const groupRaw = values.group?.trim() ?? "";
    const spec = values.spec?.trim() ?? "";
    const overhaulRaw = values.overhaulLocation?.trim() ?? "";
    const locationName = values.locationName?.trim() ?? "";
    const notes = values.notes?.trim() ?? "";
    if (!groupRaw && !spec && !overhaulRaw && !locationName && !notes) continue;
    if (groupRaw.toLowerCase() === "group") continue;
    if (spec.toLowerCase().startsWith("example:") || notes.toLowerCase().startsWith("example:")) continue;

    const group = parseSeaValveGroup(groupRaw);
    if (!group) continue;
    const overhaulLocation = parseSeaValveOverhaulLocation(overhaulRaw);
    if (!spec || !overhaulLocation) continue;

    const next = createSeaValveRow(group);
    next.spec = spec.slice(0, 80);
    next.overhaulLocation = overhaulLocation;
    next.locationName = locationName.slice(0, 160);
    next.notes = notes.slice(0, 500);
    parsed.push(next);
  }

  return parsed;
}
