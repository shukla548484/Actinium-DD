import ExcelJS from "exceljs";
import { JOB_REQUIREMENT_OPTIONS } from "@/lib/vessel/jobRequirements";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import type { VesselJobPrintBundle } from "@/lib/db/superintendent/vesselJobs";

const FORM_META = {
  formNo: "DD-03",
  revision: "Rev. 0",
  issuedBy: "Technical / Dry Dock",
  approvedBy: "Fleet Superintendent",
} as const;

const YARD_WORK_ITEMS = [
  { key: "lighting_ventilation", label: "Lighting & Ventilation" },
  { key: "cleaning_before_after", label: "Cleaning Before / After" },
  { key: "crane", label: "Crane" },
  { key: "staging", label: "Staging" },
  { key: "hot_work", label: "Hot work related" },
  { key: "gas_free", label: "Gas Free" },
  { key: "transport", label: "Transport" },
  { key: "access", label: "Access" },
  { key: "pressure_function_testing", label: "Pressure / Function Testing" },
  { key: "ndt", label: "NDT" },
  { key: "corrosion_protection", label: "Corrosion Protection" },
  { key: "paint_work", label: "Paint Work" },
] as const;

const SUPPLY_ITEMS = [
  { key: "material", label: "Material" },
  { key: "yard_supply", label: "Yard Supply" },
  { key: "owner_supply", label: "Owner's Supply" },
  { key: "maker_supply", label: "Maker's Supply" },
  { key: "drawing", label: "Drawing" },
  { key: "sketch", label: "Sketch" },
  { key: "photograph", label: "Photograph" },
  { key: "sample", label: "Sample" },
] as const;

const INSPECTION_ITEMS = [
  { key: "classification_society", label: "Classification Society" },
  { key: "flag_administration", label: "Flag Administration" },
  { key: "owners", label: "Owners" },
  { key: "manufacturers", label: "Manufacturers" },
  { key: "underwriters", label: "Underwriters" },
] as const;

const COLS = 12;
const FONT = "Calibri";
const BLACK = "FF18181B";
const ZINC_600 = "FF52525B";
const ZINC_500 = "FF71717A";
const ZINC_200 = "FFE4E4E7";
const ZINC_100 = "FFF4F4F5";
const ZINC_50 = "FFFAFAFA";
const WHITE = "FFFFFFFF";

const thin = (color = BLACK): ExcelJS.Border => ({ style: "thin", color: { argb: color } });
const medium = (color = BLACK): ExcelJS.Border => ({ style: "medium", color: { argb: color } });

function blank(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function strField(fd: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!fd) return "";
  for (const key of keys) {
    const v = fd[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function hasMeaningfulText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function checkMark(checked: boolean): string {
  return checked ? "☑" : "☐";
}

function estimateLines(text: string, charsPerLine: number): number {
  if (!text.trim()) return 1;
  return text.split("\n").reduce((sum, line) => {
    const len = Math.max(line.length, 1);
    return sum + Math.max(1, Math.ceil(len / charsPerLine));
  }, 0);
}

function styleRange(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  apply: (cell: ExcelJS.Cell) => void,
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      apply(ws.getCell(r, c));
    }
  }
}

function fillRange(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  argb: string,
) {
  styleRange(ws, r1, c1, r2, c2, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  });
}

function borderRange(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  outer: ExcelJS.Border = medium(),
  inner: ExcelJS.Border = thin("FFA1A1AA"),
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === r1 ? outer : inner,
        bottom: r === r2 ? outer : inner,
        left: c === c1 ? outer : inner,
        right: c === c2 ? outer : inner,
      };
    }
  }
}

function setRowHeight(ws: ExcelJS.Worksheet, row: number, height: number) {
  ws.getRow(row).height = height;
}

function panelTitle(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number, title: string) {
  ws.mergeCells(row, c1, row, c2);
  const cell = ws.getCell(row, c1);
  cell.value = title.toUpperCase();
  cell.font = { name: FONT, size: 8, bold: true, color: { argb: BLACK } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  fillRange(ws, row, c1, row, c2, ZINC_200);
  setRowHeight(ws, row, 14);
}

function labeledValue(
  ws: ExcelJS.Worksheet,
  row: number,
  labelC1: number,
  labelC2: number,
  valueC1: number,
  valueC2: number,
  label: string,
  value: string,
  opts?: { multiline?: boolean; height?: number },
) {
  if (labelC1 !== labelC2) ws.mergeCells(row, labelC1, row, labelC2);
  if (valueC1 !== valueC2) ws.mergeCells(row, valueC1, row, valueC2);

  const labelCell = ws.getCell(row, labelC1);
  labelCell.value = label.toUpperCase();
  labelCell.font = { name: FONT, size: 7, bold: true, color: { argb: ZINC_600 } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  fillRange(ws, row, labelC1, row, labelC2, ZINC_50);

  const valueCell = ws.getCell(row, valueC1);
  valueCell.value = value || "";
  valueCell.font = { name: FONT, size: 9, color: { argb: BLACK } };
  valueCell.alignment = {
    vertical: opts?.multiline ? "top" : "middle",
    horizontal: "left",
    indent: 1,
    wrapText: true,
  };

  const lines = opts?.multiline ? Math.max(2, estimateLines(value, 48)) : 1;
  setRowHeight(ws, row, opts?.height ?? Math.min(48, 11 + lines * 10));
}

function checklistItem(
  ws: ExcelJS.Worksheet,
  row: number,
  c1: number,
  c2: number,
  label: string,
  checked: boolean,
) {
  if (c1 !== c2) ws.mergeCells(row, c1, row, c2);
  const cell = ws.getCell(row, c1);
  cell.value = `${checkMark(checked)}  ${label}`;
  cell.font = { name: FONT, size: 8, color: { argb: BLACK } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  setRowHeight(ws, row, 12);
}

type FormView = {
  formDate: string;
  generalDescription: string;
  maker: string;
  typeAndNo: string;
  jobDescription: string;
  location: string;
  material: string;
  accessNotes: string;
  stagingNotes: string;
  specialRequirements: string;
  inspectionChecked: Record<(typeof INSPECTION_ITEMS)[number]["key"], boolean>;
  yardChecked: Record<(typeof YARD_WORK_ITEMS)[number]["key"], boolean>;
  supplyChecked: Record<(typeof SUPPLY_ITEMS)[number]["key"], boolean>;
  additionalRows: { label: string; value: string }[];
  jobNo: string;
  projectRef: string;
  yard: string;
  workshopDept: string;
  preparedBy: string;
  approvedBy: string;
  approvedAt: string;
  company: {
    name: string;
    code: string;
    address: string;
    contact: string;
    email: string;
    phone: string;
  };
  vessel: {
    name: string;
    code: string;
    imo: string;
    flag: string;
    type: string;
    gt: string;
    yearBuilt: string;
    classSociety: string;
  };
};

function buildFormView(bundle: VesselJobPrintBundle): FormView {
  const { vesselJob: job, vessel, company, dryDockProject } = bundle;
  const fd = (job.formData ?? {}) as Record<string, unknown>;

  const requirements = Array.isArray(fd.jobRequirements)
    ? (fd.jobRequirements as string[]).filter((k): k is string => typeof k === "string")
    : [];
  const reqSet = new Set(requirements);

  const maker =
    strField(fd, "machineryAssetMaker", "engineMake", "turbochargerMake", "paintMaker") ||
    strField(fd, "makeModel").split("/")[0]?.trim() ||
    "";

  const typeAndNo = [
    strField(fd, "machineryAssetModel", "engineModel", "turbochargerModel", "pumpType", "valveType", "type"),
    strField(
      fd,
      "machineryAssetSerialNumber",
      "engineCylinderNo",
      "generatorNo",
      "equipmentTag",
      "valveTag",
      "craneNameNo",
      "motorNameNo",
    ),
    strField(fd, "makeModel"),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(" · ");

  const generalDescription = [
    job.title,
    [job.systemKey, job.machineryKey, job.componentKey].filter(Boolean).join(" / "),
    strField(fd, "machineryAssetName", "pumpName", "systemLine"),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join("\n");

  const jobDescriptionParts = [
    job.description,
    job.conditionDescription,
    job.observedDefect,
    job.repairRecommendation,
    strField(fd, "jobDescription", "scopeChecklist", "repairDetails", "defectDetails"),
  ].filter(hasMeaningfulText);

  const jobDescription = jobDescriptionParts
    .filter((part, idx, arr) => {
      const normalized = part!.trim().toLowerCase();
      return arr.findIndex((p) => p!.trim().toLowerCase() === normalized) === idx;
    })
    .join("\n\n");

  const measurements =
    job.measurements && typeof job.measurements === "object"
      ? Object.entries(job.measurements).filter(([, v]) => v != null && String(v).trim() !== "")
      : [];

  const location = [strField(fd, "location", "locationOnBoard", "areaLocation"), strField(fd, "systemLine")]
    .filter(Boolean)
    .join(" · ");

  const material = [strField(fd, "material", "pipeSize"), job.replacementParts, job.consumables]
    .filter(hasMeaningfulText)
    .join("\n");

  const accessNotes = [
    reqSet.has("confined_space") ? "Confined space access required" : "",
    reqSet.has("removal_fitting") ? "Removal & fitting / transport" : "",
    strField(fd, "accessNotes", "access"),
  ]
    .filter(Boolean)
    .join(" · ");

  const stagingNotes = [
    reqSet.has("staging") ? "Staging / scaffolding required" : "",
    strField(fd, "stagingNotes", "staging"),
  ]
    .filter(Boolean)
    .join(" · ");

  const specialRequirements = [
    ...JOB_REQUIREMENT_OPTIONS.filter((o) => reqSet.has(o.key)).map((o) => o.label),
    job.priority !== "medium" ? `Priority: ${job.priority}` : "",
    job.criticality ? `Criticality: ${job.criticality}` : "",
    job.operationalRisk ? `Operational risk: ${job.operationalRisk}` : "",
    job.safetyRisk ? `Safety risk: ${job.safetyRisk}` : "",
    job.environmentalRisk ? `Environmental risk: ${job.environmentalRisk}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const inspectionChecked: FormView["inspectionChecked"] = {
    classification_society: job.classAttendance || reqSet.has("class_attendance"),
    flag_administration: false,
    owners: Boolean(job.masterReviewAction === "approved" || job.approvedAt),
    manufacturers: job.makerAttendance || reqSet.has("maker_attendance"),
    underwriters: false,
  };

  const pressureTestPresent = Boolean(
    strField(
      fd,
      "pressureTesting",
      "pressureTest",
      "pressureFunctionTestAfterRepair",
      "performanceTest",
      "loadTest",
      "runTest",
      "loadTestDetails",
    ),
  );
  const paintPresent = Boolean(
    strField(fd, "paintSystem", "paintMaker", "paintApplicationRecord", "surfacePreparation"),
  );
  const ndtPresent = /ndt|ultrasonic|mpi|dye.?penetrant|radiograph/i.test(
    `${jobDescription} ${strField(fd, "inspectionReport", "inspectionTestReport", "inspectionResults")}`,
  );

  const yardChecked: FormView["yardChecked"] = {
    lighting_ventilation: reqSet.has("lighting"),
    cleaning_before_after: /clean/i.test(
      strField(fd, "scopeChecklist", "jobDescription") || job.description || "",
    ),
    crane: reqSet.has("crane_lifting"),
    staging: reqSet.has("staging"),
    hot_work: reqSet.has("hot_work"),
    gas_free: reqSet.has("gas_free"),
    transport: reqSet.has("removal_fitting"),
    access: reqSet.has("confined_space"),
    pressure_function_testing: pressureTestPresent,
    ndt: ndtPresent,
    corrosion_protection: paintPresent || /corrosion|coat|blast/i.test(jobDescription),
    paint_work: paintPresent,
  };

  const attachmentNames = (job.attachmentMeta ?? []).map((a) => a.fileName).filter(Boolean);
  const attachmentBlob = attachmentNames.join(" ").toLowerCase();

  const supplyChecked: FormView["supplyChecked"] = {
    material:
      hasMeaningfulText(job.replacementParts) ||
      hasMeaningfulText(job.consumables) ||
      hasMeaningfulText(strField(fd, "material")),
    yard_supply: false,
    owner_supply: /owner.?suppl/i.test(
      `${job.replacementParts ?? ""} ${job.consumables ?? ""} ${JSON.stringify(fd)}`,
    ),
    maker_supply: job.makerAttendance || reqSet.has("maker_attendance"),
    drawing: /draw/.test(attachmentBlob) || Boolean(strField(fd, "drawing", "drawings")),
    sketch: /sketch/.test(attachmentBlob) || Boolean(strField(fd, "sketch")),
    photograph: job.photoCount > 0 || /photo|image|jpg|jpeg|png/.test(attachmentBlob),
    sample: /sample/.test(attachmentBlob) || Boolean(strField(fd, "sample")),
  };

  const formDate =
    fmtDate(job.submittedAt) ||
    fmtDate(job.exportAssignedAt) ||
    fmtDate(job.createdAt) ||
    new Date().toLocaleDateString();

  const additionalRows: { label: string; value: string }[] = [];
  if (job.conditionRating) {
    additionalRows.push({ label: "Condition rating", value: conditionRatingLabel(job.conditionRating) });
  }
  if (job.runningHoursAtSurvey != null) {
    additionalRows.push({ label: "Running hours at survey", value: String(job.runningHoursAtSurvey) });
  }
  if (job.lastOverhaulDate) {
    additionalRows.push({ label: "Last overhaul", value: fmtDate(job.lastOverhaulDate) });
  }
  if (job.estimatedManhours != null) {
    additionalRows.push({ label: "Estimated manhours", value: String(job.estimatedManhours) });
  }
  if (job.estimatedCost != null) {
    additionalRows.push({ label: "Estimated cost (USD)", value: job.estimatedCost.toLocaleString() });
  }
  if (dryDockProject?.name) {
    additionalRows.push({
      label: "Dry dock project",
      value: [dryDockProject.name, dryDockProject.referenceCode].filter(Boolean).join(" · "),
    });
  }
  for (const [key, value] of measurements) {
    additionalRows.push({ label: key, value: String(value) });
  }

  return {
    formDate,
    generalDescription,
    maker,
    typeAndNo,
    jobDescription,
    location,
    material,
    accessNotes,
    stagingNotes,
    specialRequirements,
    inspectionChecked,
    yardChecked,
    supplyChecked,
    additionalRows,
    jobNo: blank(job.jobCode),
    projectRef: blank(dryDockProject?.referenceCode),
    yard: blank(dryDockProject?.selectedYard) || blank(dryDockProject?.portLocation),
    workshopDept: [job.workshop, job.department ?? job.category].filter(Boolean).join(" · "),
    preparedBy: blank(job.createdByName),
    approvedBy: blank(job.approvedByName),
    approvedAt: fmtDate(job.approvedAt),
    company: {
      name: blank(company?.name),
      code: blank(company?.code),
      address: blank(company?.address),
      contact: blank(company?.contactPerson),
      email: blank(company?.contactEmail),
      phone: blank(company?.contactPhone),
    },
    vessel: {
      name: vessel.name,
      code: vessel.code,
      imo: blank(vessel.imoNumber),
      flag: blank(vessel.flag),
      type: blank(vessel.vesselType),
      gt: blank(vessel.grossTonnage),
      yearBuilt: blank(vessel.yearBuilt),
      classSociety: blank(vessel.classSociety),
    },
  };
}

/** Build DD-03 Excel workbook mirroring the print-page form layout. */
export async function buildVesselJobExcelWorkbook(
  bundle: VesselJobPrintBundle,
): Promise<ExcelJS.Workbook> {
  const view = buildFormView(bundle);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Actinium DD";
  wb.created = new Date();

  const ws = wb.addWorksheet("DD-03 Spec", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 12 },
  });

  // ~A4 printable width with narrow margins (12 cols ≈ 190mm usable)
  const widths = [9, 9, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
    printTitlesRow: undefined,
  };

  let r = 1;

  // ── 1. Header ──────────────────────────────────────────────
  const headerEnd = r + 4; // rows 1–5
  ws.mergeCells(r, 1, headerEnd, 2);
  const idCell = ws.getCell(r, 1);
  idCell.value = FORM_META.formNo;
  idCell.font = { name: FONT, size: 14, bold: true, color: { argb: BLACK } };
  idCell.alignment = { vertical: "middle", horizontal: "center" };
  fillRange(ws, r, 1, headerEnd, 2, ZINC_100);

  ws.mergeCells(r, 3, headerEnd, 8);
  const titleCell = ws.getCell(r, 3);
  titleCell.value = "DRYDOCK SPECIFICATION FOR REPAIR";
  titleCell.font = { name: FONT, size: 11, bold: true, color: { argb: BLACK } };
  titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  const metaRows: [string, string][] = [
    ["Form No.", FORM_META.formNo],
    ["Revision", FORM_META.revision],
    ["Date", view.formDate],
    ["Issued by", FORM_META.issuedBy],
    ["Approved by", FORM_META.approvedBy],
  ];
  metaRows.forEach(([label, value], i) => {
    const mr = r + i;
    ws.mergeCells(mr, 9, mr, 10);
    ws.mergeCells(mr, 11, mr, 12);
    const lc = ws.getCell(mr, 9);
    lc.value = label.toUpperCase();
    lc.font = { name: FONT, size: 7, bold: true, color: { argb: ZINC_600 } };
    lc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const vc = ws.getCell(mr, 11);
    vc.value = value;
    vc.font = { name: FONT, size: 8, bold: true, color: { argb: BLACK } };
    vc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    setRowHeight(ws, mr, 13);
  });
  borderRange(ws, r, 1, headerEnd, COLS, medium(), thin("FFA1A1AA"));
  // Strengthen vertical splits in header
  for (let hr = r; hr <= headerEnd; hr++) {
    ws.getCell(hr, 2).border = {
      ...ws.getCell(hr, 2).border,
      right: medium(),
    };
    ws.getCell(hr, 8).border = {
      ...ws.getCell(hr, 8).border,
      right: medium(),
    };
  }
  r = headerEnd + 1;

  // ── 2. Company | Vessel ────────────────────────────────────
  const companyVesselStart = r;
  panelTitle(ws, r, 1, 6, "Company details");
  panelTitle(ws, r, 7, 12, "Vessel details");
  r += 1;

  const companyFields: [string, string][] = [
    ["Company", view.company.name],
    ["Code", view.company.code],
    ["Address", view.company.address],
    ["Contact", view.company.contact],
    ["Email", view.company.email],
    ["Phone", view.company.phone],
  ];
  const vesselFields: [string, string][] = [
    ["Vessel name", view.vessel.name],
    ["Vessel code", view.vessel.code],
    ["IMO number", view.vessel.imo],
    ["Flag", view.vessel.flag],
    ["Type", view.vessel.type],
    ["Gross tonnage", view.vessel.gt],
    ["Year built", view.vessel.yearBuilt],
    ["Class society", view.vessel.classSociety],
  ];
  const detailRows = Math.max(companyFields.length, vesselFields.length);
  for (let i = 0; i < detailRows; i++) {
    const [cl, cv] = companyFields[i] ?? ["", ""];
    const [vl, vv] = vesselFields[i] ?? ["", ""];
    if (cl) {
      labeledValue(ws, r, 1, 2, 3, 6, cl, cv, {
        multiline: cl === "Address",
        height: cl === "Address" ? Math.min(36, 12 + estimateLines(cv, 36) * 10) : 13,
      });
    } else {
      ws.mergeCells(r, 1, r, 6);
      setRowHeight(ws, r, 13);
    }
    if (vl) {
      labeledValue(ws, r, 7, 8, 9, 12, vl, vv, { height: 13 });
    } else {
      ws.mergeCells(r, 7, r, 12);
      setRowHeight(ws, r, 13);
    }
    r += 1;
  }
  const companyVesselEnd = r - 1;
  borderRange(ws, companyVesselStart, 1, companyVesselEnd, COLS, medium(), thin("FFD4D4D8"));
  for (let rr = companyVesselStart; rr <= companyVesselEnd; rr++) {
    ws.getCell(rr, 6).border = { ...ws.getCell(rr, 6).border, right: medium() };
  }

  // ── 3. Job identification bar ──────────────────────────────
  const idStart = r;
  const idItems: [string, string][] = [
    ["JOB No.", view.jobNo],
    ["Project Ref.", view.projectRef],
    ["Yard", view.yard],
    ["Workshop / Dept.", view.workshopDept],
    ["Page No.", "1"],
    ["Date", view.formDate],
  ];
  idItems.forEach(([label], i) => {
    const c1 = i * 2 + 1;
    const c2 = c1 + 1;
    ws.mergeCells(r, c1, r, c2);
    const cell = ws.getCell(r, c1);
    cell.value = label.toUpperCase();
    cell.font = { name: FONT, size: 7, bold: true, color: { argb: ZINC_600 } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    fillRange(ws, r, c1, r, c2, ZINC_50);
  });
  setRowHeight(ws, r, 12);
  r += 1;
  idItems.forEach(([, value], i) => {
    const c1 = i * 2 + 1;
    const c2 = c1 + 1;
    ws.mergeCells(r, c1, r, c2);
    const cell = ws.getCell(r, c1);
    cell.value = value;
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: BLACK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  setRowHeight(ws, r, 16);
  borderRange(ws, idStart, 1, r, COLS, medium(), thin());
  for (let i = 0; i < 5; i++) {
    const col = (i + 1) * 2;
    ws.getCell(idStart, col).border = { ...ws.getCell(idStart, col).border, right: medium() };
    ws.getCell(r, col).border = { ...ws.getCell(r, col).border, right: medium() };
  }
  r += 1;

  // ── 4. General description | Inspection ────────────────────
  const genStart = r;
  panelTitle(ws, r, 1, 7, "General description · Maker · Type & No.");
  panelTitle(ws, r, 8, 12, "Inspection / Surveys");
  r += 1;

  const genDescLines = Math.max(2, estimateLines(view.generalDescription, 55));
  labeledValue(ws, r, 1, 2, 3, 7, "General description", view.generalDescription, {
    multiline: true,
    height: Math.min(42, 12 + genDescLines * 10),
  });
  const inspRow0 = r;
  checklistItem(ws, r, 8, 12, INSPECTION_ITEMS[0].label, view.inspectionChecked[INSPECTION_ITEMS[0].key]);
  r += 1;

  labeledValue(ws, r, 1, 2, 3, 7, "Maker", view.maker, { height: 13 });
  checklistItem(ws, r, 8, 12, INSPECTION_ITEMS[1].label, view.inspectionChecked[INSPECTION_ITEMS[1].key]);
  r += 1;

  labeledValue(ws, r, 1, 2, 3, 7, "Type & No.", view.typeAndNo, { height: 13 });
  checklistItem(ws, r, 8, 12, INSPECTION_ITEMS[2].label, view.inspectionChecked[INSPECTION_ITEMS[2].key]);
  r += 1;

  // Remaining inspection items (pad left empty if needed)
  for (let i = 3; i < INSPECTION_ITEMS.length; i++) {
    ws.mergeCells(r, 1, r, 7);
    checklistItem(ws, r, 8, 12, INSPECTION_ITEMS[i].label, view.inspectionChecked[INSPECTION_ITEMS[i].key]);
    r += 1;
  }
  const genEnd = r - 1;
  borderRange(ws, genStart, 1, genEnd, COLS, medium(), thin("FFD4D4D8"));
  for (let rr = genStart; rr <= genEnd; rr++) {
    ws.getCell(rr, 7).border = { ...ws.getCell(rr, 7).border, right: medium() };
  }
  // Ensure inspection side has light fill continuity
  fillRange(ws, inspRow0, 8, genEnd, 12, WHITE);

  // ── 5. Actual job description | Yard work ──────────────────
  const jobStart = r;
  panelTitle(ws, r, 1, 7, "Actual Job description");
  panelTitle(ws, r, 8, 12, "Yard Work");
  r += 1;

  const yardCount = YARD_WORK_ITEMS.length;
  const jobLines = Math.max(yardCount, estimateLines(view.jobDescription, 55));
  const jobBodyStart = r;
  const jobBodyEnd = r + yardCount - 1;

  ws.mergeCells(jobBodyStart, 1, jobBodyEnd, 7);
  const jobCell = ws.getCell(jobBodyStart, 1);
  jobCell.value = view.jobDescription || "";
  jobCell.font = { name: FONT, size: 9, color: { argb: BLACK } };
  jobCell.alignment = { vertical: "top", horizontal: "left", indent: 1, wrapText: true };

  YARD_WORK_ITEMS.forEach((item, i) => {
    checklistItem(ws, jobBodyStart + i, 8, 12, item.label, view.yardChecked[item.key]);
  });

  const perRowH = Math.max(12, Math.min(14, Math.ceil((12 + jobLines * 9) / yardCount)));
  for (let i = 0; i < yardCount; i++) {
    setRowHeight(ws, jobBodyStart + i, perRowH);
  }
  r = jobBodyEnd + 1;
  borderRange(ws, jobStart, 1, jobBodyEnd, COLS, medium(), thin("FFD4D4D8"));
  for (let rr = jobStart; rr <= jobBodyEnd; rr++) {
    ws.getCell(rr, 7).border = { ...ws.getCell(rr, 7).border, right: medium() };
  }

  // ── 6. Location / material | Supply ────────────────────────
  const locStart = r;
  panelTitle(ws, r, 1, 7, "Location · Material · Access · Staging · Special requirements");
  panelTitle(ws, r, 8, 12, "Supply");
  r += 1;

  const locFields: [string, string][] = [
    ["Location", view.location],
    ["Material", view.material],
    ["Access", view.accessNotes],
    ["Staging", view.stagingNotes],
    ["Special requirements", view.specialRequirements],
  ];
  const supplyCount = SUPPLY_ITEMS.length;
  const locBodyRows = Math.max(locFields.length, supplyCount);

  for (let i = 0; i < locBodyRows; i++) {
    if (i < locFields.length) {
      const [label, value] = locFields[i]!;
      labeledValue(ws, r, 1, 2, 3, 7, label, value, {
        multiline: true,
        height: Math.min(28, 12 + estimateLines(value, 48) * 9),
      });
    } else {
      ws.mergeCells(r, 1, r, 7);
      setRowHeight(ws, r, 12);
    }
    if (i < supplyCount) {
      const item = SUPPLY_ITEMS[i]!;
      checklistItem(ws, r, 8, 12, item.label, view.supplyChecked[item.key]);
    } else {
      ws.mergeCells(r, 8, r, 12);
      setRowHeight(ws, r, 12);
    }
    r += 1;
  }
  const locEnd = r - 1;
  borderRange(ws, locStart, 1, locEnd, COLS, medium(), thin("FFD4D4D8"));
  for (let rr = locStart; rr <= locEnd; rr++) {
    ws.getCell(rr, 7).border = { ...ws.getCell(rr, 7).border, right: medium() };
  }

  // ── Additional details (once only, if any) ─────────────────
  if (view.additionalRows.length > 0) {
    const addStart = r;
    panelTitle(ws, r, 1, 12, "Additional details");
    r += 1;
    for (let i = 0; i < view.additionalRows.length; i += 2) {
      const left = view.additionalRows[i]!;
      const right = view.additionalRows[i + 1];
      labeledValue(ws, r, 1, 2, 3, 6, left.label, left.value, { height: 13 });
      if (right) {
        labeledValue(ws, r, 7, 8, 9, 12, right.label, right.value, { height: 13 });
      } else {
        ws.mergeCells(r, 7, r, 12);
        setRowHeight(ws, r, 13);
      }
      r += 1;
    }
    borderRange(ws, addStart, 1, r - 1, COLS, medium(), thin("FFD4D4D8"));
  }

  // ── 7. Footer signatures ───────────────────────────────────
  const footStart = r;
  const signs: [string, string, string][] = [
    ["Prepared by", view.preparedBy, "Name / Rank"],
    ["Approved by Supdt.", view.approvedBy, "Name"],
    ["Signature & date", view.approvedAt, "Signature / Date"],
  ];
  signs.forEach(([label, value, sub], i) => {
    const c1 = i * 4 + 1;
    const c2 = c1 + 3;
    ws.mergeCells(r, c1, r, c2);
    const lc = ws.getCell(r, c1);
    lc.value = label.toUpperCase();
    lc.font = { name: FONT, size: 7, bold: true, color: { argb: ZINC_600 } };
    lc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });
  setRowHeight(ws, r, 12);
  r += 1;

  signs.forEach(([, value], i) => {
    const c1 = i * 4 + 1;
    const c2 = c1 + 3;
    ws.mergeCells(r, c1, r, c2);
    const vc = ws.getCell(r, c1);
    vc.value = value;
    vc.font = { name: FONT, size: 9, bold: true, color: { argb: BLACK } };
    vc.alignment = { vertical: "bottom", horizontal: "left", indent: 1 };
    // underline feel via bottom border on this row
  });
  setRowHeight(ws, r, 22);
  r += 1;

  signs.forEach(([, , sub], i) => {
    const c1 = i * 4 + 1;
    const c2 = c1 + 3;
    ws.mergeCells(r, c1, r, c2);
    const sc = ws.getCell(r, c1);
    sc.value = sub.toUpperCase();
    sc.font = { name: FONT, size: 6, color: { argb: ZINC_500 } };
    sc.alignment = { vertical: "top", horizontal: "left", indent: 1 };
  });
  setRowHeight(ws, r, 11);

  borderRange(ws, footStart, 1, r, COLS, medium(), thin());
  for (let rr = footStart; rr <= r; rr++) {
    ws.getCell(rr, 4).border = { ...ws.getCell(rr, 4).border, right: medium() };
    ws.getCell(rr, 8).border = { ...ws.getCell(rr, 8).border, right: medium() };
  }
  // Signature underline
  for (let i = 0; i < 3; i++) {
    const c1 = i * 4 + 1;
    const c2 = c1 + 3;
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(footStart + 1, c);
      cell.border = {
        ...cell.border,
        bottom: thin(ZINC_600),
      };
    }
  }

  ws.pageSetup.printArea = `A1:L${r}`;

  // Outer sheet outline already applied per section; ensure unused default is white
  styleRange(ws, 1, 1, r, COLS, (cell) => {
    if (!cell.fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    }
  });

  return wb;
}

export async function downloadVesselJobExcel(bundle: VesselJobPrintBundle): Promise<string> {
  const wb = await buildVesselJobExcelWorkbook(bundle);
  const code =
    bundle.vesselJob.jobCode?.replace(/[^\w.-]+/g, "_") || bundle.vesselJob.id.slice(0, 8);
  const filename = `${code}-DD-03-spec.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}
