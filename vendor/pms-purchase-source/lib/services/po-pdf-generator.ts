import { jsPDF } from 'jspdf';
import { Requisition, RequisitionItem, Vessel, Employee, Vendor, VendorQuote, VendorQuoteItem, Company } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getActiniumLogoBuffer } from '@/lib/excel-branding';
import { registerAptosFonts, setPoPdfFont } from '@/lib/services/pdf-aptos-font';

interface POData {
  poNumber: string;
  dateOfIssue: Date;
  requisition: Requisition & {
    items: RequisitionItem[];
    vessel: Vessel & {
      company?: Company;
    };
    createdBy: Employee;
  };
  quote: VendorQuote & {
    vendor: Vendor;
    quotedItems: VendorQuoteItem[];
  };
  userRemarks?: string;
  vendorRemarks?: string;
  conditions?: string;
  leadTime?: string;
  portOfDelivery?: string;
  agentDetails?: string;
}

type RegisteringCompanyDetails = {
  name: string;
  address?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  code?: string | null;
};

async function resolveRegisteringCompany(
  vessel: POData['requisition']['vessel']
): Promise<RegisteringCompanyDetails> {
  const fallback: RegisteringCompanyDetails = { name: 'Actinium Ship Management' };

  if (vessel.company) {
    return {
      name: vessel.company.name || fallback.name,
      address: vessel.company.address,
      contactPerson: vessel.company.contactPerson,
      contactEmail: vessel.company.contactEmail,
      contactPhone: vessel.company.contactPhone,
      code: vessel.company.code,
    };
  }

  if (vessel.companyId) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: vessel.companyId },
        select: {
          name: true,
          code: true,
          address: true,
          contactPerson: true,
          contactEmail: true,
          contactPhone: true,
        },
      });
      if (company) {
        return {
          name: company.name,
          address: company.address,
          contactPerson: company.contactPerson,
          contactEmail: company.contactEmail,
          contactPhone: company.contactPhone,
          code: company.code,
        };
      }
    } catch (error) {
      console.error('Error fetching registering company:', error);
    }
  }

  return fallback;
}

function drawRegisteringCompanyHeader(
  pdf: jsPDF,
  company: RegisteringCompanyDetails,
  rightEdge: number,
  yStart: number,
  maxWidth: number
): number {
  let y = yStart;

  pdf.setFontSize(CONTENT_TITLE_FONT);
  poFont(pdf, 'bold', CONTENT_TITLE_FONT);
  pdf.setTextColor(0, 0, 0);
  pdf.text(company.name, rightEdge, y, { align: 'right' });
  y += 4.5;

  poFont(pdf, 'normal', CONTENT_BODY_FONT);

  const detailLines: string[] = [];
  if (company.address?.trim()) detailLines.push(company.address.trim());
  if (company.contactPhone?.trim()) detailLines.push(`Tel: ${company.contactPhone.trim()}`);
  if (company.contactEmail?.trim()) detailLines.push(`Email: ${company.contactEmail.trim()}`);
  if (company.contactPerson?.trim()) detailLines.push(`Contact: ${company.contactPerson.trim()}`);
  if (company.code?.trim()) detailLines.push(`Company Code: ${company.code.trim()}`);

  for (const line of detailLines) {
    const wrapped = measureWrappedLines(pdf, line, maxWidth);
    for (const wrappedLine of wrapped) {
      pdf.text(wrappedLine, rightEdge, y, { align: 'right' });
      y += TEXT_LINE_HEIGHT;
    }
  }

  return y;
}

const ACTINIUM_LOGO_MAX_WIDTH_MM = 18;
const ACTINIUM_LOGO_MAX_HEIGHT_MM = 14;

type PreparedActiniumLogo = {
  dataUrl: string;
  aspectRatio: number;
};

let cachedLogoForPdf: PreparedActiniumLogo | null | undefined;

/** Square Actinium emblem with black matte removed for white PDF pages. */
async function loadActiniumLogoForPdf(): Promise<PreparedActiniumLogo | null> {
  if (cachedLogoForPdf !== undefined) return cachedLogoForPdf;

  const buffer = getActiniumLogoBuffer();
  if (!buffer) {
    cachedLogoForPdf = null;
    return null;
  }

  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data);
    const threshold = 42;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r <= threshold && g <= threshold && b <= threshold) {
        pixels[i + 3] = 0;
      }
    }

    const processed = await sharp(Buffer.from(pixels), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .trim()
      .png()
      .toBuffer({ resolveWithObject: true });

    const aspectRatio =
      processed.info.height > 0 ? processed.info.width / processed.info.height : 1;

    cachedLogoForPdf = {
      dataUrl: `data:image/png;base64,${processed.data.toString('base64')}`,
      aspectRatio,
    };
    return cachedLogoForPdf;
  } catch (error) {
    console.error('Failed to prepare Actinium logo for PO PDF:', error);
    cachedLogoForPdf = null;
    return null;
  }
}

function resolveLogoDimensionsMm(aspectRatio: number): { width: number; height: number } {
  const safeAspect = aspectRatio > 0 ? aspectRatio : 1;
  let width = ACTINIUM_LOGO_MAX_WIDTH_MM;
  let height = width / safeAspect;
  if (height > ACTINIUM_LOGO_MAX_HEIGHT_MM) {
    height = ACTINIUM_LOGO_MAX_HEIGHT_MM;
    width = height * safeAspect;
  }
  return { width, height };
}

async function drawActiniumLogoTopLeft(pdf: jsPDF, x: number, y: number): Promise<number> {
  const logo = await loadActiniumLogoForPdf();
  if (logo) {
    try {
      const { width, height } = resolveLogoDimensionsMm(logo.aspectRatio);
      pdf.addImage(logo.dataUrl, 'PNG', x, y, width, height, undefined, 'FAST');
      return y + height;
    } catch (error) {
      console.error('Failed to embed Actinium logo in PO PDF:', error);
    }
  }

  poFont(pdf, 'bold', CONTENT_TITLE_FONT);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Actinium-sm', x, y + 4);
  return y + 7;
}

/**
 * Helper function to draw a two-column information table (Field Name | Value)
 */
const CONTENT_TITLE_FONT = 8;
const CONTENT_BODY_FONT = 6;
const ITEMS_TABLE_FONT = 5;
const FOOTER_BODY_FONT = 6;
const TEXT_LINE_HEIGHT = 3.2;
const TABLE_PADDING = 1.5;
const TABLE_TITLE_HEIGHT = 6;
const CARD_BORDER_WIDTH = 0.1;
const CARD_LINE_WIDTH = 0.08;
const CARD_BORDER_RGB = 200;

let pdfUseAptos = false;

function poFont(pdf: jsPDF, style: 'normal' | 'bold' | 'italic', fontSize: number): void {
  setPoPdfFont(pdf, style, fontSize, pdfUseAptos);
}

function applyCardStroke(pdf: jsPDF, width: number = CARD_BORDER_WIDTH): void {
  pdf.setLineWidth(width);
  pdf.setDrawColor(CARD_BORDER_RGB, CARD_BORDER_RGB, CARD_BORDER_RGB);
}

const IHM_COMPLIANCE_TEXT =
  'Products supplied under this Purchase Order are delivered in accordance with the Hong Kong Convention (HKC), EU Ship Recycling Regulation (EU SRR), and IMO Resolution MEPC.269(68) on Inventory of Hazardous Materials (IHM). The products supplied shall not contain Hazardous Material unless explicitly declared. Material Declaration (MD) and Supplier\'s Declaration of Conformity (SDoC) documents shall be provided where applicable. Single-use plastic for packaging is not allowed.';

function buildPoDisclaimer(companyName: string): string {
  return `Disclaimer: This Purchase Order is issued by ${companyName}, acting as agent on behalf of the Principal. ${companyName} has authority to issue this Purchase Order on behalf of the Principal and shall bear no liability whatsoever for any circumstances arising from the issuance of this Purchase Order.`;
}

function measureWrappedLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, Math.max(4, maxWidth));
}

function rowHeightForLines(lineCount: number, minHeight = 5): number {
  return Math.max(minHeight, lineCount * TEXT_LINE_HEIGHT + TABLE_PADDING);
}

const PAGE_TOP_MARGIN = 15;
const PAGE_BOTTOM_MARGIN = 12;

function ensurePageSpace(pdf: jsPDF, yPosition: number, needed: number, pageHeight: number): number {
  if (yPosition + needed > pageHeight - PAGE_BOTTOM_MARGIN) {
    pdf.addPage();
    return PAGE_TOP_MARGIN;
  }
  return yPosition;
}

function estimateInfoTableHeight(
  pdf: jsPDF,
  data: Array<[string, string]>,
  width: number,
  labelWidthRatio = 0.38,
  bottomSpacing = 8
): number {
  const layouts = buildInfoRowLayouts(pdf, data, width, labelWidthRatio);
  return TABLE_TITLE_HEIGHT + layouts.reduce((sum, row) => sum + row.rowHeight, 0) + bottomSpacing;
}

function estimatePlainTextSectionHeight(
  pdf: jsPDF,
  body: string,
  width: number,
  fontSize = FOOTER_BODY_FONT
): number {
  poFont(pdf, 'italic', fontSize);
  const bodyLines = measureWrappedLines(pdf, body, width);
  const titleGap = 3.5;
  return titleGap + TEXT_LINE_HEIGHT + bodyLines.length * TEXT_LINE_HEIGHT + 6;
}

type InfoRowLayout = {
  fieldName: string;
  value: string;
  nameLines: string[];
  valueLines: string[];
  rowHeight: number;
};

function buildInfoRowLayouts(
  pdf: jsPDF,
  data: Array<[string, string]>,
  width: number,
  labelWidthRatio = 0.38
): InfoRowLayout[] {
  const padding = TABLE_PADDING;
  const fieldNameWidth = width * labelWidthRatio;
  const valueWidth = width - fieldNameWidth - padding * 2;

  poFont(pdf, 'normal', CONTENT_BODY_FONT);

  return data.map(([fieldName, value]) => {
    poFont(pdf, 'bold', CONTENT_BODY_FONT);
    const nameLines = measureWrappedLines(pdf, fieldName, fieldNameWidth - padding);
    poFont(pdf, 'normal', CONTENT_BODY_FONT);
    const valueLines = measureWrappedLines(pdf, String(value || ''), valueWidth);
    const lineCount = Math.max(nameLines.length, valueLines.length, 1);
    return {
      fieldName,
      value: String(value || ''),
      nameLines,
      valueLines,
      rowHeight: rowHeightForLines(lineCount),
    };
  });
}

function drawInfoTableWithLayouts(
  pdf: jsPDF,
  title: string,
  layouts: InfoRowLayout[],
  x: number,
  y: number,
  width: number,
  options?: { bottomSpacing?: number; labelWidthRatio?: number }
): number {
  const titleHeight = TABLE_TITLE_HEIGHT;
  const padding = TABLE_PADDING;
  const bottomSpacing = options?.bottomSpacing ?? 8;
  const labelWidthRatio = options?.labelWidthRatio ?? 0.38;
  const fieldNameWidth = width * labelWidthRatio;
  const tableHeight = titleHeight + layouts.reduce((sum, row) => sum + row.rowHeight, 0);

  applyCardStroke(pdf);
  pdf.rect(x, y, width, tableHeight);

  pdf.setFillColor(240, 240, 240);
  pdf.rect(x, y, width, titleHeight, 'F');

  poFont(pdf, 'bold', CONTENT_TITLE_FONT);
  pdf.setTextColor(0, 0, 0);
  pdf.text(title, x + padding, y + 4.5);

  applyCardStroke(pdf, CARD_LINE_WIDTH);
  pdf.line(x, y + titleHeight, x + width, y + titleHeight);
  pdf.line(x + fieldNameWidth, y, x + fieldNameWidth, y + tableHeight);

  let currentY = y + titleHeight;

  layouts.forEach((row, index) => {
    poFont(pdf, 'bold', CONTENT_BODY_FONT);
    pdf.text(row.nameLines, x + padding, currentY + 3.5);
    poFont(pdf, 'normal', CONTENT_BODY_FONT);
    pdf.text(row.valueLines, x + fieldNameWidth + padding, currentY + 3.5);

    currentY += row.rowHeight;
    if (index < layouts.length - 1) {
      applyCardStroke(pdf, CARD_LINE_WIDTH);
      pdf.line(x, currentY, x + width, currentY);
    }
  });

  return y + tableHeight + bottomSpacing;
}

function drawInfoTable(
  pdf: jsPDF,
  title: string,
  data: Array<[string, string]>,
  x: number,
  y: number,
  width: number,
  options?: { bottomSpacing?: number; labelWidthRatio?: number }
): number {
  const layouts = buildInfoRowLayouts(
    pdf,
    data,
    width,
    options?.labelWidthRatio ?? 0.38
  );
  return drawInfoTableWithLayouts(pdf, title, layouts, x, y, width, options);
}

function padInfoTableRows(
  data: Array<[string, string]>,
  targetRows: number
): Array<[string, string]> {
  if (data.length >= targetRows) return data;
  return [
    ...data,
    ...Array.from({ length: targetRows - data.length }, () => ['', ''] as [string, string]),
  ];
}

function estimateInfoTablePairHeight(
  pdf: jsPDF,
  left: Array<[string, string]>,
  right: Array<[string, string]>,
  totalWidth: number,
  gap = 4,
  labelWidthRatio = 0.48
): number {
  const columnWidth = (totalWidth - gap) / 2;
  const rowCount = Math.max(left.length, right.length, 1);
  const leftLayouts = buildInfoRowLayouts(pdf, padInfoTableRows(left, rowCount), columnWidth, labelWidthRatio);
  const rightLayouts = buildInfoRowLayouts(pdf, padInfoTableRows(right, rowCount), columnWidth, labelWidthRatio);
  const bodyHeight = leftLayouts.reduce(
    (sum, row, index) => sum + Math.max(row.rowHeight, rightLayouts[index].rowHeight),
    0
  );
  return TABLE_TITLE_HEIGHT + bodyHeight + 8;
}

function drawInfoTablePair(
  pdf: jsPDF,
  left: { title: string; data: Array<[string, string]> },
  right: { title: string; data: Array<[string, string]> },
  x: number,
  y: number,
  totalWidth: number,
  gap = 4
): number {
  const columnWidth = (totalWidth - gap) / 2;
  const labelWidthRatio = 0.48;
  const rowCount = Math.max(left.data.length, right.data.length, 1);
  const leftData = padInfoTableRows(left.data, rowCount);
  const rightData = padInfoTableRows(right.data, rowCount);

  const leftLayouts = buildInfoRowLayouts(pdf, leftData, columnWidth, labelWidthRatio);
  const rightLayouts = buildInfoRowLayouts(pdf, rightData, columnWidth, labelWidthRatio);
  const sharedHeights = leftLayouts.map((row, index) =>
    Math.max(row.rowHeight, rightLayouts[index].rowHeight)
  );
  const mergedLeft = leftLayouts.map((row, index) => ({ ...row, rowHeight: sharedHeights[index] }));
  const mergedRight = rightLayouts.map((row, index) => ({ ...row, rowHeight: sharedHeights[index] }));

  const leftEndY = drawInfoTableWithLayouts(pdf, left.title, mergedLeft, x, y, columnWidth, {
    bottomSpacing: 0,
    labelWidthRatio,
  });
  const rightEndY = drawInfoTableWithLayouts(
    pdf,
    right.title,
    mergedRight,
    x + columnWidth + gap,
    y,
    columnWidth,
    { bottomSpacing: 0, labelWidthRatio }
  );
  return Math.max(leftEndY, rightEndY) + 8;
}

function drawPlainTextSection(
  pdf: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  width: number,
  options?: { fontSize?: number }
): number {
  const bodySize = options?.fontSize ?? FOOTER_BODY_FONT;
  const titleGap = 3.5;

  poFont(pdf, 'italic', CONTENT_TITLE_FONT);
  pdf.setTextColor(0, 0, 0);
  pdf.text(title, x, y);

  poFont(pdf, 'italic', bodySize);
  const bodyLines = measureWrappedLines(pdf, body, width);
  pdf.text(bodyLines, x, y + titleGap + TEXT_LINE_HEIGHT);

  return y + titleGap + TEXT_LINE_HEIGHT + bodyLines.length * TEXT_LINE_HEIGHT + 6;
}

function drawSupplierQuoteRemarkTable(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  data: {
    comment: string;
    quotationReference: string;
    deliveryPortExWork: string;
    validityPeriod: string;
    expectedReadiness: string;
  }
): number {
  const titleHeight = TABLE_TITLE_HEIGHT;
  const padding = TABLE_PADDING;
  const title = "SUPPLIER'S QUOTE REMARK";
  const colWidths = [width * 0.24, width * 0.26, width * 0.24, width * 0.26];

  type GridRow = { cells: Array<{ label: string; value: string; bold?: boolean }> };
  const rows: GridRow[] = [
    { cells: [{ label: 'Comment:', value: data.comment || 'N/A', bold: true }] },
    {
      cells: [
        { label: 'Quotation Reference Number:', value: data.quotationReference || 'N/A', bold: true },
        { label: 'Delivery Port / Ex-Work:', value: data.deliveryPortExWork || 'N/A', bold: true },
      ],
    },
    {
      cells: [
        { label: 'Validity Period:', value: data.validityPeriod || 'N/A', bold: true },
        { label: 'Expected Date of Readiness:', value: data.expectedReadiness || 'N/A', bold: true },
      ],
    },
  ];

  poFont(pdf, 'normal', CONTENT_BODY_FONT);
  const rowHeights = rows.map((row) => {
    if (row.cells.length === 1) {
      const labelWidth = width * 0.24 - padding * 2;
      const valueWidth = width * 0.76 - padding * 2;
      poFont(pdf, 'bold', CONTENT_BODY_FONT);
      const labelLines = measureWrappedLines(pdf, row.cells[0].label, labelWidth);
      poFont(pdf, 'normal', CONTENT_BODY_FONT);
      const valueLines = measureWrappedLines(pdf, row.cells[0].value, valueWidth);
      return rowHeightForLines(Math.max(labelLines.length, valueLines.length));
    }

    const pairHeights = row.cells.map((cell, index) => {
      const labelWidth = colWidths[index * 2] - padding * 2;
      const valueWidth = colWidths[index * 2 + 1] - padding * 2;
      poFont(pdf, 'bold', CONTENT_BODY_FONT);
      const labelLines = measureWrappedLines(pdf, cell.label, labelWidth);
      poFont(pdf, 'normal', CONTENT_BODY_FONT);
      const valueLines = measureWrappedLines(pdf, cell.value, valueWidth);
      return rowHeightForLines(Math.max(labelLines.length, valueLines.length));
    });
    return Math.max(...pairHeights);
  });

  const tableHeight = titleHeight + rowHeights.reduce((sum, h) => sum + h, 0);

  applyCardStroke(pdf);
  pdf.rect(x, y, width, tableHeight);

  pdf.setFillColor(240, 240, 240);
  pdf.rect(x, y, width, titleHeight, 'F');

  poFont(pdf, 'bold', CONTENT_TITLE_FONT);
  pdf.text(title, x + padding, y + 4.5);

  applyCardStroke(pdf, CARD_LINE_WIDTH);
  pdf.line(x, y + titleHeight, x + width, y + titleHeight);

  let currentY = y + titleHeight;
  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];

    if (row.cells.length === 1) {
      const labelWidth = width * 0.24;
      const cell = row.cells[0];
      applyCardStroke(pdf, CARD_LINE_WIDTH);
      pdf.line(x + labelWidth, currentY, x + labelWidth, currentY + rowHeight);
      poFont(pdf, 'bold', CONTENT_BODY_FONT);
      pdf.text(
        measureWrappedLines(pdf, cell.label, labelWidth - padding * 2),
        x + padding,
        currentY + 3.5
      );
      poFont(pdf, 'normal', CONTENT_BODY_FONT);
      pdf.text(
        measureWrappedLines(pdf, cell.value, width - labelWidth - padding * 2),
        x + labelWidth + padding,
        currentY + 3.5
      );
    } else {
      let colX = x;
      row.cells.forEach((cell, cellIndex) => {
        const labelColWidth = colWidths[cellIndex * 2];
        const valueColWidth = colWidths[cellIndex * 2 + 1];
        const pairWidth = labelColWidth + valueColWidth;
        applyCardStroke(pdf, CARD_LINE_WIDTH);
        pdf.line(colX + labelColWidth, currentY, colX + labelColWidth, currentY + rowHeight);
        poFont(pdf, 'bold', CONTENT_BODY_FONT);
        pdf.text(
          measureWrappedLines(pdf, cell.label, labelColWidth - padding * 2),
          colX + padding,
          currentY + 3.5
        );
        poFont(pdf, 'normal', CONTENT_BODY_FONT);
        pdf.text(
          measureWrappedLines(pdf, cell.value, valueColWidth - padding * 2),
          colX + labelColWidth + padding,
          currentY + 3.5
        );
        colX += pairWidth;
        if (cellIndex < row.cells.length - 1) {
          applyCardStroke(pdf, CARD_LINE_WIDTH);
          pdf.line(colX, currentY, colX, currentY + rowHeight);
        }
      });
    }

    currentY += rowHeight;
    if (rowIndex < rows.length - 1) {
      applyCardStroke(pdf, CARD_LINE_WIDTH);
      pdf.line(x, currentY, x + width, currentY);
    }
  });

  return y + tableHeight + 8;
}

function estimateSupplierQuoteRemarkHeight(
  pdf: jsPDF,
  width: number,
  data: {
    comment: string;
    quotationReference: string;
    deliveryPortExWork: string;
    validityPeriod: string;
    expectedReadiness: string;
  }
): number {
  const padding = TABLE_PADDING;
  const colWidths = [width * 0.24, width * 0.26, width * 0.24, width * 0.26];
  const rows = [
    { cells: [{ label: 'Comment:', value: data.comment || 'N/A' }] },
    {
      cells: [
        { label: 'Quotation Reference Number:', value: data.quotationReference || 'N/A' },
        { label: 'Delivery Port / Ex-Work:', value: data.deliveryPortExWork || 'N/A' },
      ],
    },
    {
      cells: [
        { label: 'Validity Period:', value: data.validityPeriod || 'N/A' },
        { label: 'Expected Date of Readiness:', value: data.expectedReadiness || 'N/A' },
      ],
    },
  ];

  poFont(pdf, 'normal', CONTENT_BODY_FONT);
  const rowHeights = rows.map((row) => {
    if (row.cells.length === 1) {
      const labelWidth = width * 0.24 - padding * 2;
      const valueWidth = width * 0.76 - padding * 2;
      poFont(pdf, 'bold', CONTENT_BODY_FONT);
      const labelLines = measureWrappedLines(pdf, row.cells[0].label, labelWidth);
      poFont(pdf, 'normal', CONTENT_BODY_FONT);
      const valueLines = measureWrappedLines(pdf, row.cells[0].value, valueWidth);
      return rowHeightForLines(Math.max(labelLines.length, valueLines.length));
    }

    const pairHeights = row.cells.map((cell, index) => {
      const labelWidth = colWidths[index * 2] - padding * 2;
      const valueWidth = colWidths[index * 2 + 1] - padding * 2;
      poFont(pdf, 'bold', CONTENT_BODY_FONT);
      const labelLines = measureWrappedLines(pdf, cell.label, labelWidth);
      poFont(pdf, 'normal', CONTENT_BODY_FONT);
      const valueLines = measureWrappedLines(pdf, cell.value, valueWidth);
      return rowHeightForLines(Math.max(labelLines.length, valueLines.length));
    });
    return Math.max(...pairHeights);
  });

  return TABLE_TITLE_HEIGHT + rowHeights.reduce((sum, h) => sum + h, 0) + 8;
}

/**
 * Generate Purchase Order PDF matching the reference format
 */
export async function generatePOPDF(data: POData): Promise<Buffer> {
  const {
    poNumber,
    dateOfIssue,
    requisition,
    quote,
    userRemarks,
    vendorRemarks,
    conditions,
    leadTime,
    portOfDelivery,
    agentDetails,
  } = data;

  // Registering company (vessel owner / operator entity)
  const registeringCompany = await resolveRegisteringCompany(requisition.vessel);
  const companyName = registeringCompany.name;

  // Create PDF document (A4 portrait)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  pdfUseAptos = registerAptosFonts(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 15;
  const rightMargin = 15;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const headerStartY = 10;
  const headerColumnWidth = usableWidth * 0.48;
  const rightEdge = pageWidth - rightMargin;

  // Top left: Actinium emblem. Top right: vessel registering company details.
  const leftHeaderBottom = await drawActiniumLogoTopLeft(pdf, leftMargin, headerStartY);

  const rightHeaderBottom = drawRegisteringCompanyHeader(
    pdf,
    registeringCompany,
    rightEdge,
    headerStartY,
    headerColumnWidth
  );

  const headerBottom = Math.max(leftHeaderBottom, rightHeaderBottom) + 4;

  pdf.setDrawColor(210, 210, 210);
  pdf.setLineWidth(CARD_LINE_WIDTH);
  pdf.line(leftMargin, headerBottom, rightEdge, headerBottom);

  let yPosition = headerBottom + 6;

  poFont(pdf, 'bold', 14);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Purchase Order', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // VESSEL INFORMATION + PURCHASE ORDER DETAILS (side by side)
  const vesselInfo: Array<[string, string]> = [
    ['Vessel Name', requisition.vessel.name || ''],
    ['IMO Number', requisition.vessel.imoNumber || ''],
    ['Port of Registry', requisition.vessel.portOfRegistry || ''],
    ['Class', requisition.vessel.vesselClass || requisition.vessel.classificationSociety || ''],
    ['Hull', requisition.vessel.builders || ''],
  ];

  const expectedDeliveryDate = portOfDelivery && leadTime 
    ? new Date(new Date(dateOfIssue).getTime() + parseInt(leadTime) * 24 * 60 * 60 * 1000).toLocaleDateString()
    : '';
  
  const poDetails: Array<[string, string]> = [
    ['PO Number', poNumber],
    ['PO Date', dateOfIssue.toLocaleDateString()],
    ['Expected Delivery Date', expectedDeliveryDate || ''],
    ['Total Amount', `${quote.currency || 'USD'} ${Number(quote.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Vessel Name', requisition.vessel.name || ''],
  ];

  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimateInfoTablePairHeight(pdf, vesselInfo, poDetails, usableWidth),
    pageHeight
  );
  yPosition = drawInfoTablePair(
    pdf,
    { title: 'VESSEL INFORMATION', data: vesselInfo },
    { title: 'PURCHASE ORDER DETAILS', data: poDetails },
    leftMargin,
    yPosition,
    usableWidth
  );

  // SUPPLIER INFORMATION + BILLING ADDRESS (side by side)
  const supplierInfo: Array<[string, string]> = [
    ['Supplier Name', quote.vendor.name || ''],
    ['Supplier PIC', quote.vendor.contactPerson || ''],
    ['Email', quote.vendor.primaryEmail || ''],
    ['Phone', quote.vendor.phone || ''],
  ];

  const billingAddress: Array<[string, string]> = [];
  if (quote.vendor.address) {
    billingAddress.push(['Billing Address', quote.vendor.address]);
  } else {
    billingAddress.push(['Billing Address', quote.vendor.name || '']);
  }
  if (quote.vendor.city) {
    billingAddress.push(['City', quote.vendor.city]);
  }
  if (quote.vendor.country) {
    billingAddress.push(['Country', quote.vendor.country]);
  }

  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimateInfoTablePairHeight(pdf, supplierInfo, billingAddress, usableWidth),
    pageHeight
  );
  yPosition = drawInfoTablePair(
    pdf,
    { title: 'SUPPLIER INFORMATION', data: supplierInfo },
    { title: 'BILLING ADDRESS', data: billingAddress },
    leftMargin,
    yPosition,
    usableWidth
  );

  // AGENT INFORMATION Section
  const agentInfo: Array<[string, string]> = [];
  if (agentDetails) {
    // Try to parse agent details if it's JSON
    try {
      const parsed = typeof agentDetails === 'string' ? JSON.parse(agentDetails) : agentDetails;
      agentInfo.push(['Agent Name', parsed.name || parsed.agentName || '']);
      agentInfo.push(['Agent PIC', parsed.pic || parsed.contactPerson || '']);
      agentInfo.push(['Email', parsed.email || '']);
      agentInfo.push(['Phone', parsed.phone || '']);
      agentInfo.push(['Country', parsed.country || '']);
    } catch {
      // If not JSON, use as plain text
      agentInfo.push(['Agent Details', agentDetails]);
    }
  } else {
    agentInfo.push(['Agent Name', '']);
    agentInfo.push(['Agent PIC', '']);
    agentInfo.push(['Email', '']);
    agentInfo.push(['Phone', '']);
    agentInfo.push(['Country', '']);
  }
  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimateInfoTableHeight(pdf, agentInfo, usableWidth, 0.32),
    pageHeight
  );
  yPosition = drawInfoTable(pdf, 'AGENT INFORMATION', agentInfo, leftMargin, yPosition, usableWidth, {
    labelWidthRatio: 0.32,
  });

  // Additional purchaser remarks (vendor comments appear in Supplier's Quote Remark)
  if (userRemarks || conditions) {
    const additionalInfo: Array<[string, string]> = [];
    if (userRemarks) additionalInfo.push(['User Remarks', userRemarks]);
    if (conditions) additionalInfo.push(['Conditions', conditions]);

    if (additionalInfo.length > 0) {
      yPosition = ensurePageSpace(
        pdf,
        yPosition,
        estimateInfoTableHeight(pdf, additionalInfo, usableWidth, 0.32),
        pageHeight
      );
      yPosition = drawInfoTable(pdf, 'ADDITIONAL INFORMATION', additionalInfo, leftMargin, yPosition, usableWidth, {
        labelWidthRatio: 0.32,
      });
    }
  }

  // Items Table — wrapped text, scaled to page width
  if (quote.quotedItems && quote.quotedItems.length > 0) {
    const lineHeight = TEXT_LINE_HEIGHT;
    const cellPadding = TABLE_PADDING;
    const minRowHeight = 5;

    const tableHeaders = ['S.No.', 'Item Name', 'Qty', 'Unit', 'Unit Price', 'Total Price'];
    const baseColWidths = [12, 68, 14, 14, 28, 28];
    const baseTotal = baseColWidths.reduce((sum, w) => sum + w, 0);
    const colWidths = baseColWidths.map((w) => (w / baseTotal) * usableWidth);
    const tableWidth = usableWidth;

    const currency = quote.currency || 'USD';
    const formatItemAmount = (value: unknown) =>
      `${currency} ${Number(value ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const tableRows = quote.quotedItems
      .filter((item) => Number(item.quantity ?? 0) > 0)
      .map((item, index) => [
      (index + 1).toString(),
      item.itemName || '',
      item.quantity?.toString() || '0',
      item.unit || '',
      item.unitPrice ? formatItemAmount(item.unitPrice) : formatItemAmount(0),
      item.totalPrice ? formatItemAmount(item.totalPrice) : formatItemAmount(0),
    ]);

    pdf.setFontSize(ITEMS_TABLE_FONT);
    const headerHeight = 6;

    // Precompute wrapped lines and row heights (no truncation, full text wrapped)
    const wrappedRows: string[][][] = tableRows.map((row) =>
      row.map((cell, cellIndex) =>
        pdf.splitTextToSize(String(cell), Math.max(4, colWidths[cellIndex] - cellPadding * 2))
      )
    );
    const rowHeights = wrappedRows.map((cellLines) =>
      Math.max(minRowHeight, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + cellPadding)
    );
    const totalTableHeight = headerHeight + rowHeights.reduce((a, b) => a + b, 0);

    yPosition = ensurePageSpace(pdf, yPosition, 7 + totalTableHeight + 8, pageHeight);

    pdf.setFontSize(CONTENT_TITLE_FONT);
    poFont(pdf, 'bold', CONTENT_TITLE_FONT);
    pdf.setTextColor(0, 0, 0);
    pdf.text('ITEMS', leftMargin, yPosition);
    yPosition += 7;

    // Draw table border
    applyCardStroke(pdf);
    pdf.rect(leftMargin, yPosition, tableWidth, totalTableHeight);

    // Draw header background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(leftMargin, yPosition, tableWidth, headerHeight, 'F');

    poFont(pdf, 'bold', ITEMS_TABLE_FONT);
    pdf.setTextColor(0, 0, 0);
    let currentX = leftMargin;
    tableHeaders.forEach((header, index) => {
      const headerLines = measureWrappedLines(
        pdf,
        header,
        Math.max(4, colWidths[index] - cellPadding * 2)
      );
      headerLines.forEach((line, lineIdx) => {
        pdf.text(line, currentX + cellPadding, yPosition + 3.5 + lineIdx * lineHeight);
      });
      if (index < tableHeaders.length - 1) {
        applyCardStroke(pdf, CARD_LINE_WIDTH);
        pdf.line(currentX + colWidths[index], yPosition, currentX + colWidths[index], yPosition + totalTableHeight);
      }
      currentX += colWidths[index];
    });

    applyCardStroke(pdf, CARD_LINE_WIDTH);
    pdf.line(leftMargin, yPosition + headerHeight, leftMargin + tableWidth, yPosition + headerHeight);

    poFont(pdf, 'normal', ITEMS_TABLE_FONT);
    let currentY = yPosition + headerHeight;
    wrappedRows.forEach((cellLines, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      const contentTop = currentY + cellPadding;
      cellLines.forEach((lines, cellIndex) => {
        const x = leftMargin + colWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0) + cellPadding;
        lines.forEach((line, lineIdx) => {
          pdf.text(line, x, contentTop + lineIdx * lineHeight);
        });
      });
      const rowBottom = currentY + rowHeight;
      if (rowIndex < wrappedRows.length - 1) {
        applyCardStroke(pdf, CARD_LINE_WIDTH);
        pdf.line(leftMargin, rowBottom, leftMargin + tableWidth, rowBottom);
      }
      currentY = rowBottom;
    });

    yPosition = currentY + 8;
  }

  const supplierComment =
    quote.notes?.trim() ||
    vendorRemarks?.trim() ||
    quote.termsAndConditions?.trim() ||
    'N/A';
  const deliveryPortExWork =
    quote.deliveryPort?.trim() ||
    quote.exWorkLocation?.trim() ||
    portOfDelivery?.trim() ||
    requisition.portOfSupply?.trim() ||
    'N/A';
  const validityPeriod =
    quote.validityPeriod?.trim() ||
    (quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '') ||
    'N/A';
  const expectedReadiness =
    quote.leadTime?.trim() || leadTime?.trim() || 'N/A';

  const supplierRemarkData = {
    comment: supplierComment,
    quotationReference: quote.quotationReference?.trim() || quote.quoteNumber?.trim() || 'N/A',
    deliveryPortExWork,
    validityPeriod,
    expectedReadiness,
  };

  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimateSupplierQuoteRemarkHeight(pdf, usableWidth, supplierRemarkData),
    pageHeight
  );
  yPosition = drawSupplierQuoteRemarkTable(pdf, leftMargin, yPosition, usableWidth, supplierRemarkData);

  const ihmDeclarationNote = quote.ihmDeclaration?.trim()
    ? `Supplier IHM declaration: ${quote.ihmDeclaration}. `
    : '';
  const ihmBody = `${ihmDeclarationNote}${IHM_COMPLIANCE_TEXT}`;

  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimatePlainTextSectionHeight(pdf, ihmBody, usableWidth),
    pageHeight
  );
  yPosition = drawPlainTextSection(
    pdf,
    'IHM RELATED COMMENTS',
    ihmBody,
    leftMargin,
    yPosition,
    usableWidth
  );

  const disclaimerBody = buildPoDisclaimer(companyName);
  yPosition = ensurePageSpace(
    pdf,
    yPosition,
    estimatePlainTextSectionHeight(pdf, disclaimerBody, usableWidth),
    pageHeight
  );
  yPosition = drawPlainTextSection(
    pdf,
    'DISCLAIMER',
    disclaimerBody,
    leftMargin,
    yPosition,
    usableWidth
  );

  // Generate PDF buffer
  const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
  return pdfBuffer;
}
