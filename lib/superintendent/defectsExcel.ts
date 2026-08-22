import ExcelJS from "exceljs";

export const DEFECT_IMPORT_DEPARTMENTS = [
  "Deck",
  "Engine",
  "Electrical",
  "Hull",
  "Machinery",
  "Safety",
  "Catering",
  "Bridge",
  "Other",
] as const;

export const DEFECT_IMPORT_COLUMNS = {
  department: "Department",
  defectDetails: "Defect details",
  machineryAssociated: "Machinery associated (if any)",
  requisitionNumber: "Requisition number (if any)",
} as const;

const PHOTO_HEADER_KEYS = ["photo", "photos", "image", "images", "picture", "attachment", "attachments"];

export type DefectImportVesselContext = {
  vesselName: string;
  vesselCode: string;
  imoNumber: string | null;
  hullNumber: string | null;
  flag: string | null;
  classSociety: string | null;
  vesselType: string | null;
  callSign: string | null;
  grossTonnage: number | null;
  yearBuilt: number | null;
  companyName: string;
  companyCode: string;
  companyAddress: string | null;
  companyContactPerson: string | null;
  companyContactEmail: string | null;
  companyContactPhone: string | null;
  projectName: string;
  projectCode: string | null;
};

export type ParsedDefectRow = {
  department: string;
  defectDetails: string;
  machineryAssociated: string | null;
  requisitionNumber: string | null;
};

const HEADER_ALIASES: Record<keyof typeof DEFECT_IMPORT_COLUMNS, string[]> = {
  department: ["department", "dept", "workshop", "trade"],
  defectDetails: ["defect details", "defect detail", "defect", "details", "description", "finding"],
  machineryAssociated: ["machinery associated", "machinery", "equipment", "plant", "component"],
  requisitionNumber: ["requisition number", "requisition no", "req no", "req number", "pr number", "po number"],
};

function blank(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function createWorkbook(): ExcelJS.Workbook {
  const ns = ExcelJS as unknown as {
    Workbook?: typeof ExcelJS.Workbook;
    default?: { Workbook: typeof ExcelJS.Workbook };
  };
  const Workbook = ns.Workbook ?? ns.default?.Workbook;
  if (!Workbook) {
    throw new Error("Excel library failed to load (exceljs). Restart the dev server after npm install.");
  }
  return new Workbook();
}

function toNodeBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Failed to serialize Excel workbook.");
}

async function protectParticularsSheet(ws: ExcelJS.Worksheet): Promise<void> {
  try {
    await ws.protect("actinium-dd", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      spinCount: 1,
    });
  } catch (err) {
    console.warn("[defectsExcel] worksheet protect skipped", err);
  }
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_/.-]+/g, " ").trim();
}

function isPhotoHeader(header: string): boolean {
  const n = normalizeHeader(header);
  return PHOTO_HEADER_KEYS.some((k) => n === k || n.includes(k));
}

function matchColumn(header: string): keyof typeof DEFECT_IMPORT_COLUMNS | null {
  const n = normalizeHeader(header);
  if (!n || isPhotoHeader(n)) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof typeof DEFECT_IMPORT_COLUMNS,
    string[],
  ][]) {
    if (aliases.some((alias) => n === alias || n.includes(alias))) return key;
  }
  return null;
}

export async function buildDefectImportTemplateWorkbook(
  ctx: DefectImportVesselContext,
): Promise<Buffer> {
  const wb = createWorkbook();
  wb.creator = "Actinium DD";
  wb.created = new Date();

  const particulars = wb.addWorksheet("Vessel particulars", {
    views: [{ showGridLines: false }],
  });
  particulars.columns = [
    { width: 32 },
    { width: 56 },
  ];

  particulars.mergeCells(1, 1, 1, 2);
  const title = particulars.getCell(1, 1);
  title.value = "Defect import template — vessel particulars (from database)";
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

  const hullNumber = blank(ctx.hullNumber) || blank(ctx.vesselCode);
  const rows: [string, string][] = [
    ["Vessel name", blank(ctx.vesselName)],
    ["IMO number", blank(ctx.imoNumber)],
    ["Hull / vessel code", hullNumber],
    ["Flag", blank(ctx.flag)],
    ["Class society", blank(ctx.classSociety)],
    ["Vessel type", blank(ctx.vesselType)],
    ["Call sign", blank(ctx.callSign)],
    ["Gross tonnage", ctx.grossTonnage != null ? String(ctx.grossTonnage) : ""],
    ["Year built", ctx.yearBuilt != null ? String(ctx.yearBuilt) : ""],
    ["Company name", blank(ctx.companyName)],
    ["Company code", blank(ctx.companyCode)],
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
  await protectParticularsSheet(particulars);

  const defects = wb.addWorksheet("Defects");
  defects.columns = [
    { width: 22 },
    { width: 72 },
    { width: 36 },
    { width: 28 },
  ];
  defects.mergeCells(1, 1, 1, 4);
  defects.getCell(1, 1).value =
    "Fill one row per defect. Department and defect details are required. Machinery and requisition number are optional. Photos are not accepted in this Excel.";
  defects.getCell(1, 1).font = { italic: true, size: 10, color: { argb: "FF495057" } };
  defects.getCell(1, 1).alignment = { wrapText: true };
  defects.getRow(1).height = 32;

  const headers = [
    DEFECT_IMPORT_COLUMNS.department,
    DEFECT_IMPORT_COLUMNS.defectDetails,
    DEFECT_IMPORT_COLUMNS.machineryAssociated,
    DEFECT_IMPORT_COLUMNS.requisitionNumber,
  ];
  headers.forEach((header, i) => {
    const cell = defects.getCell(3, i + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  defects.getRow(3).height = 22;

  const sample = defects.getRow(4);
  sample.values = [DEFECT_IMPORT_DEPARTMENTS[1], "Example: ME turbocharger vibration above maker limit.", "Main engine turbocharger", "REQ-0001"];
  sample.font = { italic: true, color: { argb: "FF6C757D" } };

  for (let r = 5; r <= 54; r++) {
    for (let c = 1; c <= 4; c++) {
      const cell = defects.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFDEE2E6" } },
        bottom: { style: "thin", color: { argb: "FFDEE2E6" } },
        left: { style: "thin", color: { argb: "FFDEE2E6" } },
        right: { style: "thin", color: { argb: "FFDEE2E6" } },
      };
      cell.protection = { locked: false };
    }
  }

  defects.views = [{ state: "frozen", ySplit: 3 }];

  const guide = wb.addWorksheet("Guide");
  guide.columns = [{ width: 92 }];
  const guideLines = [
    "How to use this template",
    "1. Leave Vessel particulars unchanged — they come from the vessel and company database.",
    "2. On the Defects sheet, add one row per defect.",
    "3. Required: Department, Defect details.",
    "4. Optional: Machinery associated, Requisition number.",
    "5. Do not add photos, images, or attachment columns. This Excel import does not support photos.",
    "6. Delete the example row before upload if you do not want it imported.",
    "7. Upload the filled file on the dry dock project dashboard.",
    `Suggested departments: ${DEFECT_IMPORT_DEPARTMENTS.join(", ")}.`,
  ];
  guideLines.forEach((line, i) => {
    guide.getCell(i + 1, 1).value = line;
    guide.getCell(i + 1, 1).font = i === 0 ? { bold: true, size: 13 } : { size: 11 };
    guide.getRow(i + 1).height = 18;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return toNodeBuffer(buffer);
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

function findDefectsSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const named = wb.worksheets.find((ws) => ws.name.toLowerCase() === "defects");
  if (named) return named;
  return (
    wb.worksheets.find((ws) => {
      const n = ws.name.toLowerCase();
      return n !== "guide" && n !== "vessel particulars" && n !== "vessel particulars (from database)";
    }) ?? null
  );
}

export async function parseDefectImportWorkbook(buffer: ArrayBuffer | Buffer): Promise<ParsedDefectRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const sheet = findDefectsSheet(wb);
  if (!sheet) return [];

  let headerRow = 0;
  const colMap = new Map<number, keyof typeof DEFECT_IMPORT_COLUMNS>();

  sheet.eachRow((row, rowNumber) => {
    if (headerRow > 0) return;
    const hits: Array<[number, keyof typeof DEFECT_IMPORT_COLUMNS]> = [];
    row.eachCell((cell, colNumber) => {
      const mapped = matchColumn(cellText(cell.value));
      if (mapped) hits.push([colNumber, mapped]);
    });
    const keys = new Set(hits.map(([, k]) => k));
    if (keys.has("department") && keys.has("defectDetails")) {
      headerRow = rowNumber;
      for (const [col, key] of hits) colMap.set(col, key);
    }
  });

  if (headerRow === 0) return [];

  const parsed: ParsedDefectRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Partial<Record<keyof typeof DEFECT_IMPORT_COLUMNS, string>> = {};
    row.eachCell((cell, colNumber) => {
      const key = colMap.get(colNumber);
      if (!key) return;
      values[key] = cellText(cell.value);
    });
    const department = values.department?.trim() ?? "";
    const defectDetails = values.defectDetails?.trim() ?? "";
    if (!department && !defectDetails) continue;
    if (department.toLowerCase() === "department") continue;
    if (defectDetails.toLowerCase().startsWith("example:")) continue;
    if (!department || !defectDetails) continue;

    parsed.push({
      department: department.slice(0, 80),
      defectDetails,
      machineryAssociated: values.machineryAssociated?.trim() || null,
      requisitionNumber: values.requisitionNumber?.trim() || null,
    });
  }

  return parsed;
}

export function defectRowKey(row: Pick<ParsedDefectRow, "department" | "defectDetails">): string {
  return `${row.department.trim().toLowerCase()}::${row.defectDetails.trim().toLowerCase()}`;
}
