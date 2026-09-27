import ExcelJS from "exceljs";
import {
  MACHINERY_REGISTER_DEPARTMENTS,
  MACHINERY_REGISTER_IMPORT_COLUMNS,
  normalizeMachineryDepartment,
  type MachineryRegisterImportColumnKey,
  type MachineryRegisterImportRow,
} from "@/lib/machinery/machineryRegisterImport";

export {
  MACHINERY_REGISTER_DEPARTMENTS,
  MACHINERY_REGISTER_IMPORT_COLUMNS,
  machineryDuplicateKey,
  normalizeMachineryDepartment,
  validateMachineryImportRow,
  type MachineryRegisterImportColumnKey,
  type MachineryRegisterImportRow,
} from "@/lib/machinery/machineryRegisterImport";

const HEADER_ALIASES: Record<MachineryRegisterImportColumnKey, string[]> = {
  name: ["machinery name", "name", "asset name", "equipment name", "machinery"],
  maker: ["make", "maker", "manufacturer", "oem"],
  model: ["model", "type"],
  serialNumber: ["serial number", "serial", "s/n", "sn"],
  units: ["units", "qty", "quantity"],
  location: ["location", "space", "compartment"],
  department: ["department / category", "department", "category", "dept"],
  notes: ["notes", "remarks", "comment", "comments"],
  status: ["status", "active", "is active"],
};

const IGNORED_HEADERS = [
  "identification number",
  "identification",
  "id number",
  "asset id",
  "machinery id",
  "nameplate",
  "photo",
  "photos",
  "image",
  "images",
];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_/.-]+/g, " ").trim();
}

function isIgnoredHeader(header: string): boolean {
  const n = normalizeHeader(header);
  return IGNORED_HEADERS.some((k) => n === k || n.includes(k));
}

function matchColumn(header: string): MachineryRegisterImportColumnKey | null {
  const n = normalizeHeader(header);
  if (!n || isIgnoredHeader(n)) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    MachineryRegisterImportColumnKey,
    string[],
  ][]) {
    if (aliases.some((alias) => n === alias)) return key;
  }
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    MachineryRegisterImportColumnKey,
    string[],
  ][]) {
    if (aliases.some((alias) => alias.length >= 4 && n.includes(alias))) return key;
  }
  return null;
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

function parseStatus(raw: string): boolean {
  if (!raw.trim()) return true;
  const n = raw.trim().toLowerCase();
  if (["false", "0", "inactive", "deactive", "deactivated", "no", "n"].includes(n)) {
    return false;
  }
  return true;
}

export async function buildMachineryRegisterTemplateWorkbook(opts?: {
  vesselName?: string | null;
  vesselCode?: string | null;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Actinium DD";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Machinery register");
  sheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 20 },
    { width: 28 },
    { width: 12 },
  ];

  sheet.mergeCells(1, 1, 1, 9);
  const note = sheet.getCell(1, 1);
  const vesselLabel =
    [opts?.vesselName?.trim(), opts?.vesselCode?.trim()].filter(Boolean).join(" / ") ||
    "this vessel";
  note.value = `Machinery register import for ${vesselLabel}. Fill one row per asset. Identification numbers are auto-generated on confirm — do not add an ID column. Nameplate photos cannot be imported from Excel; add photos later via Edit.`;
  note.font = { italic: true, size: 10, color: { argb: "FF495057" } };
  note.alignment = { wrapText: true };
  sheet.getRow(1).height = 36;

  const headers = Object.values(MACHINERY_REGISTER_IMPORT_COLUMNS);
  headers.forEach((header, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  sheet.getRow(3).height = 22;

  const sample = sheet.getRow(4);
  sample.values = [
    "Example: Auxiliary Generator No.3",
    "Caterpillar",
    "C18",
    "SN-001",
    "1 set",
    "Engine room",
    "Electrical",
    "Example row — delete before upload if not needed",
    "Active",
  ];
  sample.font = { italic: true, color: { argb: "FF6C757D" } };

  for (let r = 5; r <= 104; r++) {
    for (let c = 1; c <= 9; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFDEE2E6" } },
        bottom: { style: "thin", color: { argb: "FFDEE2E6" } },
        left: { style: "thin", color: { argb: "FFDEE2E6" } },
        right: { style: "thin", color: { argb: "FFDEE2E6" } },
      };
      cell.protection = { locked: false };
    }
  }

  const deptList = MACHINERY_REGISTER_DEPARTMENTS.join(",");
  // exceljs Worksheet typings omit dataValidations on some versions.
  const validations = (
    sheet as ExcelJS.Worksheet & {
      dataValidations: { add: (range: string, options: object) => void };
    }
  ).dataValidations;
  validations.add("G4:G104", {
    type: "list",
    allowBlank: true,
    formulae: [`"${deptList}"`],
    showErrorMessage: true,
    errorTitle: "Department",
    error: "Pick a department from the list, or leave blank for Machinery.",
  });
  validations.add("I4:I104", {
    type: "list",
    allowBlank: true,
    formulae: ['"Active,Deactive"'],
    showErrorMessage: true,
    errorTitle: "Status",
    error: "Use Active or Deactive.",
  });

  sheet.views = [{ state: "frozen", ySplit: 3 }];

  const guide = wb.addWorksheet("Guide");
  guide.columns = [{ width: 96 }];
  const guideLines = [
    "How to use this template",
    "1. On the Machinery register sheet, add one row per machinery asset.",
    "2. Required: Machinery name.",
    "3. Optional: Make, Model, Serial number, Units, Location, Department / category, Notes, Status.",
    "4. Status: Active (default) or Deactive.",
    "5. Identification numbers are assigned automatically when you confirm registration — leave ID blank / omit the column.",
    "6. Nameplate photos cannot be imported from Excel. Register first, then Edit each asset to attach a photo.",
    "7. Delete the example row before upload if you do not want it imported.",
    "8. After upload, review and edit the parsed rows, then Confirm registration.",
    `Departments: ${MACHINERY_REGISTER_DEPARTMENTS.join(", ")}.`,
  ];
  guideLines.forEach((line, i) => {
    guide.getCell(i + 1, 1).value = line;
    guide.getCell(i + 1, 1).font = i === 0 ? { bold: true, size: 13 } : { size: 11 };
    guide.getRow(i + 1).height = 18;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function findMachinerySheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const named = wb.worksheets.find((ws) => {
    const n = ws.name.toLowerCase();
    return (
      n === "machinery register" ||
      n === "machinery" ||
      n === "register" ||
      n === "assets"
    );
  });
  if (named) return named;
  return (
    wb.worksheets.find((ws) => {
      const n = ws.name.toLowerCase();
      return n !== "guide" && n !== "vessel particulars";
    }) ?? null
  );
}

export async function parseMachineryRegisterWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<MachineryRegisterImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const sheet = findMachinerySheet(wb);
  if (!sheet) return [];

  let headerRow = 0;
  const colMap = new Map<number, MachineryRegisterImportColumnKey>();

  sheet.eachRow((row, rowNumber) => {
    if (headerRow > 0) return;
    const hits: Array<[number, MachineryRegisterImportColumnKey]> = [];
    row.eachCell((cell, colNumber) => {
      const mapped = matchColumn(cellText(cell.value));
      if (mapped) hits.push([colNumber, mapped]);
    });
    const keys = new Set(hits.map(([, k]) => k));
    if (keys.has("name")) {
      headerRow = rowNumber;
      for (const [col, key] of hits) colMap.set(col, key);
    }
  });

  if (headerRow === 0) return [];

  const parsed: MachineryRegisterImportRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Partial<Record<MachineryRegisterImportColumnKey, string>> = {};
    row.eachCell((cell, colNumber) => {
      const key = colMap.get(colNumber);
      if (!key) return;
      values[key] = cellText(cell.value);
    });

    const name = values.name?.trim() ?? "";
    const maker = values.maker?.trim() ?? "";
    const model = values.model?.trim() ?? "";
    const serialNumber = values.serialNumber?.trim() ?? "";
    const units = values.units?.trim() ?? "";
    const location = values.location?.trim() ?? "";
    const department = normalizeMachineryDepartment(values.department ?? "");
    const notes = values.notes?.trim() ?? "";
    const statusRaw = values.status?.trim() ?? "";

    if (
      !name &&
      !maker &&
      !model &&
      !serialNumber &&
      !units &&
      !location &&
      !values.department?.trim() &&
      !notes &&
      !statusRaw
    ) {
      continue;
    }

    if (/^example\b/i.test(name)) continue;

    parsed.push({
      name,
      maker,
      model,
      serialNumber,
      units,
      location,
      department,
      notes,
      isActive: parseStatus(statusRaw),
      sourceRow: r,
    });
  }

  return parsed;
}

export function excelAttachmentResponse(buffer: Buffer, filename: string): Response {
  const body = Uint8Array.from(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
