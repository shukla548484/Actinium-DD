import ExcelJS from 'exceljs';

/** Actinium-sm product identity for all Excel exports */
export const ACTINIUM_BRAND = {
  name: 'Actinium-sm',
  website: 'https://www.actinium-sm.org',
  websiteLabel: 'www.actinium-sm.org',
  supportEmail: 'support@actinium-sm.org',
  logoFileName: 'actinium-sm-logo.png',
} as const;

/**
 * Branding colors — Actinium-sm rose / yellow / orange theme (matches app/globals.css)
 */
export const BRAND_COLORS = {
  PRIMARY: { argb: 'FFE11D48' }, // Rose — primary brand
  SECONDARY: { argb: 'FFF97316' }, // Orange — section & table headers
  ACCENT: { argb: 'FFFEF9C3' }, // Light yellow — title band
  HEADER: { argb: 'FFFFF7ED' }, // Warm cream — footer band
  SUCCESS: { argb: 'FF16A34A' },
  WARNING: { argb: 'FFF59E0B' }, // Amber
  ERROR: { argb: 'FFDC2626' },
  WHITE: { argb: 'FFFFFFFF' },
  BLACK: { argb: 'FF000000' },
  BORDER: { argb: 'FFE5E5E5' },
  TEXT_DARK: { argb: 'FF422006' }, // Warm brown on yellow/orange bands
  TEXT_LIGHT: { argb: 'FFFFFFFF' },
  LINK: { argb: 'FFE11D48' },
};

/** Theme-aligned Excel cell fills — use for color-only updates without layout changes */
export const EXCEL_THEME = {
  TABLE_HEADER: BRAND_COLORS.SECONDARY,
  TABLE_HEADER_ALT: BRAND_COLORS.HEADER,
  SECTION_TITLE: BRAND_COLORS.ACCENT,
  DATA_LOCKED: BRAND_COLORS.ACCENT,
  DATA_EDITABLE: { argb: 'FFFFF7ED' },
  DATA_CALCULATED: { argb: 'FFFFF1F2' },
  ZEBRA: { argb: 'FFFFF1F2' },
  HIGHLIGHT_BEST: BRAND_COLORS.SUCCESS,
  HIGHLIGHT_ALT: BRAND_COLORS.HEADER,
  SUBHEADER: BRAND_COLORS.ACCENT,
  MUTED_TEXT: { argb: 'FF78716C' },
  BORDER: BRAND_COLORS.BORDER,
};

let cachedLogoBuffer: Buffer | null | undefined;

/** Read Actinium-sm logo from /public (server-side). Cached after first read. */
export function getActiniumLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer !== undefined) return cachedLogoBuffer;
  try {
    // Lazy require keeps this module safe when only BRAND_COLORS is imported
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const publicDir = path.join(process.cwd(), 'public');
    const candidates = [
      ACTINIUM_BRAND.logoFileName,
      'Actinium-sm logo.png',
      'Actinium-sm Logo.png',
    ];
    for (const name of candidates) {
      const logoPath = path.join(publicDir, name);
      if (fs.existsSync(logoPath)) {
        cachedLogoBuffer = fs.readFileSync(logoPath);
        return cachedLogoBuffer;
      }
    }
    cachedLogoBuffer = null;
  } catch {
    cachedLogoBuffer = null;
  }
  return cachedLogoBuffer;
}

function columnLetters(colSpan: number): string {
  let endCol = '';
  let num = colSpan;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    endCol = String.fromCharCode(65 + remainder) + endCol;
    num = Math.floor((num - 1) / 26);
  }
  return endCol;
}

export function columnLetterFromIndex(colIndex: number): string {
  let result = '';
  let num = colIndex;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/** Embed Actinium-sm logo on the top-left of a header row. */
export function embedActiniumLogo(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  startRow: number
): boolean {
  const buffer = getActiniumLogoBuffer();
  if (!buffer) return false;
  const imageId = workbook.addImage({ buffer, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 0, row: startRow - 1 },
    ext: { width: 132, height: 34 },
    editAs: 'absolute',
  });
  return true;
}

/** Apply hyperlink styling for actinium-sm.org */
export function setActiniumWebsiteLink(cell: ExcelJS.Cell, label?: string): void {
  cell.value = {
    text: label ?? ACTINIUM_BRAND.websiteLabel,
    hyperlink: ACTINIUM_BRAND.website,
    tooltip: ACTINIUM_BRAND.website,
  };
  cell.font = {
    size: 10,
    bold: true,
    color: BRAND_COLORS.LINK,
    underline: true,
    name: 'Arial',
  };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

/**
 * Add branded header to worksheet (rose / yellow theme + logo + actinium-sm.org link)
 */
export function addBrandedHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
  startRow: number = 1,
  colSpan: number = 10,
  companyName?: string
): number {
  // Brand bar needs ≥6 columns (logo | company | link). Smaller colSpan values overlap merges.
  const layoutColSpan = Math.max(colSpan, 6);
  const endCol = columnLetters(layoutColSpan);
  const linkStartCol = columnLetterFromIndex(Math.max(2, layoutColSpan - 1));
  const companyEndCol = columnLetterFromIndex(Math.max(3, layoutColSpan - 2));

  const displayCompanyName = companyName?.trim() || 'Ship Manager Company';

  // Row 1: Brand bar — logo | company name | actinium-sm.org link
  worksheet.mergeCells(`A${startRow}:B${startRow}`);
  const logoArea = worksheet.getCell(`A${startRow}`);
  logoArea.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.PRIMARY };
  addBorders(logoArea, 'medium');

  worksheet.mergeCells(`C${startRow}:${companyEndCol}${startRow}`);
  const brandCell = worksheet.getCell(`C${startRow}`);
  brandCell.value = displayCompanyName;
  brandCell.font = {
    bold: true,
    size: 16,
    color: BRAND_COLORS.TEXT_LIGHT,
    name: 'Arial',
  };
  brandCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.PRIMARY };
  addBorders(brandCell, 'medium');

  worksheet.mergeCells(`${linkStartCol}${startRow}:${endCol}${startRow}`);
  const linkCell = worksheet.getCell(`${linkStartCol}${startRow}`);
  linkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.PRIMARY };
  setActiniumWebsiteLink(linkCell);
  addBorders(linkCell, 'medium');

  worksheet.getRow(startRow).height = 42;
  const workbook = worksheet.workbook;
  if (workbook) embedActiniumLogo(workbook, worksheet, startRow);

  // Row 2: Title — span at least the data columns requested by caller
  const titleEndCol = columnLetters(Math.max(colSpan, layoutColSpan));
  if (title) {
    worksheet.mergeCells(`A${startRow + 1}:${titleEndCol}${startRow + 1}`);
    const titleCell = worksheet.getCell(`A${startRow + 1}`);
    titleCell.value = title;
    titleCell.font = {
      bold: true,
      size: 16,
      color: BRAND_COLORS.TEXT_DARK,
      name: 'Arial',
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.ACCENT };
    addBorders(titleCell, 'thin');
    worksheet.getRow(startRow + 1).height = 25;
  }

  // Row 3: Subtitle (optional)
  if (subtitle) {
    worksheet.mergeCells(`A${startRow + 2}:${titleEndCol}${startRow + 2}`);
    const subtitleCell = worksheet.getCell(`A${startRow + 2}`);
    subtitleCell.value = subtitle;
    subtitleCell.font = {
      size: 11,
      color: BRAND_COLORS.TEXT_DARK,
      italic: true,
      name: 'Arial',
    };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    worksheet.getRow(startRow + 2).height = 20;
  }

  worksheet.getRow(startRow + (subtitle ? 3 : 2)).height = 5;

  return startRow + (subtitle ? 4 : 3);
}

/**
 * Add footer with branding, actinium-sm.org link, and metadata
 */
export function addBrandedFooter(
  worksheet: ExcelJS.Worksheet,
  metadata: {
    generatedBy?: string;
    generatedAt?: Date;
    version?: string;
    contactInfo?: string;
  },
  startRow: number,
  colSpan: number = 10,
  companyName?: string
): void {
  const endCol = columnLetters(colSpan);
  const displayCompanyName = companyName?.trim() || 'Ship Manager Company';

  worksheet.getRow(startRow).height = 10;

  const footerRow = startRow + 1;
  worksheet.mergeCells(`A${footerRow}:${endCol}${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);

  let footerText = `${displayCompanyName} | Powered by ${ACTINIUM_BRAND.name} | ${ACTINIUM_BRAND.websiteLabel}`;
  if (metadata.generatedAt) {
    footerText += ` | Generated: ${metadata.generatedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (metadata.generatedBy) {
    footerText += ` | By: ${metadata.generatedBy}`;
  }
  if (metadata.version) {
    footerText += ` | Version: ${metadata.version}`;
  }
  if (metadata.contactInfo) {
    footerText += ` | ${metadata.contactInfo}`;
  } else {
    footerText += ` | ${ACTINIUM_BRAND.supportEmail}`;
  }

  footerCell.value = {
    text: footerText,
    hyperlink: ACTINIUM_BRAND.website,
    tooltip: ACTINIUM_BRAND.website,
  };
  footerCell.font = {
    size: 9,
    color: BRAND_COLORS.TEXT_DARK,
    italic: true,
    name: 'Arial',
  };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.HEADER };
  addBorders(footerCell, 'thin');
  worksheet.getRow(footerRow).height = 22;
}

/** Standard table header cell style (orange band, white text) */
export function applyActiniumTableHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, size: 11, color: BRAND_COLORS.TEXT_LIGHT, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.SECONDARY };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  addBorders(cell, 'thin');
}

/**
 * Create a new worksheet with standard Actinium-sm header; returns sheet + first data row.
 */
export function initActiniumBrandedSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  options?: {
    subtitle?: string;
    colSpan?: number;
    companyName?: string;
  }
): { worksheet: ExcelJS.Worksheet; dataStartRow: number } {
  const worksheet = workbook.addWorksheet(sheetName);
  const colSpan = options?.colSpan ?? 10;
  const dataStartRow = addBrandedHeader(
    worksheet,
    title,
    options?.subtitle,
    1,
    colSpan,
    options?.companyName
  );
  return { worksheet, dataStartRow };
}

export function styleHeaderRow(
  worksheet: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  columns: string[]
): void {
  row.height = 25;
  row.font = {
    bold: true,
    size: 11,
    color: BRAND_COLORS.TEXT_LIGHT,
    name: 'Arial',
  };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.SECONDARY };

  columns.forEach((col, index) => {
    const cell = row.getCell(index + 1);
    addBorders(cell, 'thin');
  });
}

export function styleDataRow(
  worksheet: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  isEven: boolean = false
): void {
  row.height = 20;
  row.font = { size: 10, color: BRAND_COLORS.TEXT_DARK, name: 'Arial' };
  row.alignment = { vertical: 'middle', wrapText: true };

  if (isEven) {
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' },
    };
  }

  for (let i = 1; i <= row.cellCount; i++) {
    addBorders(row.getCell(i), 'thin');
  }
}

export function addBorders(
  cell: ExcelJS.Cell,
  style: 'thin' | 'medium' | 'thick' = 'thin'
): void {
  cell.border = {
    top: { style, color: BRAND_COLORS.BORDER },
    bottom: { style, color: BRAND_COLORS.BORDER },
    left: { style, color: BRAND_COLORS.BORDER },
    right: { style, color: BRAND_COLORS.BORDER },
  };
}

export function setOptimalColumnWidths(worksheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

export function addInstructionsSection(
  worksheet: ExcelJS.Worksheet,
  instructions: string[],
  startRow: number,
  colSpan: number = 10
): number {
  const endCol = columnLetters(colSpan);

  worksheet.mergeCells(`A${startRow}:${endCol}${startRow}`);
  const headerCell = worksheet.getCell(`A${startRow}`);
  headerCell.value = 'INSTRUCTIONS:';
  headerCell.font = { bold: true, size: 12, color: BRAND_COLORS.TEXT_LIGHT, name: 'Arial' };
  headerCell.alignment = { horizontal: 'left', vertical: 'middle' };
  headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_COLORS.SECONDARY };
  addBorders(headerCell, 'thin');
  worksheet.getRow(startRow).height = 22;

  instructions.forEach((instruction, index) => {
    const row = startRow + 1 + index;
    worksheet.mergeCells(`A${row}:${endCol}${row}`);
    const cell = worksheet.getCell(`A${row}`);
    cell.value = instruction;
    cell.font = { size: 10, color: BRAND_COLORS.TEXT_DARK, name: 'Arial' };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    worksheet.getRow(row).height = 18;
  });

  return startRow + instructions.length + 2;
}

export function applyA4PageSetup(
  worksheet: ExcelJS.Worksheet,
  orientation: "portrait" | "landscape" = "landscape"
): void {
  worksheet.pageSetup = {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

/** Orange section band (Actinium theme) spanning full table width. */
export function addExcelSectionHeader(
  worksheet: ExcelJS.Worksheet,
  row: number,
  title: string,
  colSpan: number
): void {
  const endCol = columnLetters(colSpan);
  worksheet.mergeCells(`A${row}:${endCol}${row}`);
  const cell = worksheet.getCell(`A${row}`);
  cell.value = title;
  cell.font = { bold: true, size: 11, color: BRAND_COLORS.TEXT_LIGHT, name: "Arial" };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: BRAND_COLORS.SECONDARY };
  addBorders(cell, "thin");
  worksheet.getRow(row).height = 22;
}

/** Label + value pair on one row (label cols A–B, value cols C–D). */
export function writeLabelValuePair(
  worksheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string | number | Date | null | undefined,
  options?: { locked?: boolean; editable?: boolean; startCol?: number }
): void {
  const start = options?.startCol ?? 1;
  const labelCol = columnLetterFromIndex(start);
  const valueCol = columnLetterFromIndex(start + 1);
  const labelCell = worksheet.getCell(`${labelCol}${row}`);
  labelCell.value = label;
  labelCell.font = { bold: true, size: 10, name: "Arial" };
  labelCell.alignment = { vertical: "middle", wrapText: true };
  addBorders(labelCell, "thin");

  const valueCell = worksheet.getCell(`${valueCol}${row}`);
  valueCell.value = value ?? "";
  valueCell.font = { size: 10, name: "Arial" };
  valueCell.alignment = { vertical: "middle", wrapText: true };
  if (options?.editable) {
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: EXCEL_THEME.DATA_EDITABLE };
    valueCell.protection = { locked: false };
  } else if (options?.locked !== false) {
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: EXCEL_THEME.DATA_LOCKED };
    valueCell.protection = { locked: true };
  }
  addBorders(valueCell, "thin");
  worksheet.getRow(row).height = Math.max(worksheet.getRow(row).height ?? 0, 20);
}

export function createBrandedWorkbook(
  sheetName: string = 'Sheet1',
  companyName?: string
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const displayCompanyName = companyName?.trim() || ACTINIUM_BRAND.name;
  workbook.creator = ACTINIUM_BRAND.name;
  workbook.lastModifiedBy = ACTINIUM_BRAND.name;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = displayCompanyName;
  return workbook;
}
