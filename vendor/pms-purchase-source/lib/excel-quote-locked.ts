import ExcelJS from 'exceljs';
import { EXCEL_THEME } from '@/lib/excel-branding';
import { Requisition, RequisitionItem, Vessel, Employee } from '@prisma/client';
import {
  detectActiniumQuoteHeaderRow,
  getPrimaryItemLabelFromRow,
  isQuoteItemDataTerminatorRow,
  isSerialHeader,
  normalizeHeaderLabel,
} from '@/lib/excel-quote-header-detection';

interface QuoteRequestData {
  requisition: Requisition & {
    items: RequisitionItem[];
    vessel: Vessel;
    createdBy: Employee;
  };
  vendorEmail: string;
  vendorName: string;
  validUntil: Date;
  customMessage?: string;
}

function getNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  let value: any = raw;

  if (typeof value === 'object' && value !== null) {
    if ('result' in value && (value as any).result !== undefined && (value as any).result !== null) {
      value = (value as any).result;
    } else if ('value' in value && (value as any).value !== undefined && (value as any).value !== null) {
      value = (value as any).value;
    }
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    let normalized = trimmed.replace(/[^\d.,\-]/g, '');
    const hasComma = normalized.includes(',');
    const hasDot = normalized.includes('.');

    if (hasComma && !hasDot) {
      normalized = normalized.replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    const n = Number(normalized);
    if (Number.isNaN(n)) {
      return null;
    }
    return n;
  }

  const n = Number(value);
  if (Number.isNaN(n)) {
    return null;
  }
  return n;
}

type ParsedQuoteItem = {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  urgency: string;
  remarks: string;
  unitPrice: number | null;
  totalPrice: number | null;
  deliveryTime: string | null;
  /** S.No. from vendor Excel — maps 1:1 to requisition line order. */
  lineNumber: number;
  partNumber: string | null;
};

export type ParsedQuoteMetadata = {
  vendorRfqNumber: string | null;
  contactPersonEmail: string | null;
  mobile: string | null;
  leadTime: string | null;
  supplyTerms: string | null;
  paymentTerms: string | null;
  grossTotalBeforeDiscount: number | null;
  netTotalAfterDiscount: number | null;
  /** Quotation reference number from vendor (e.g. 257029) */
  quotationReference: string | null;
  /** Validity period text (e.g. "30 days", "15 days") */
  validityPeriod: string | null;
  /** Delivery port / ex-work location (e.g. "United Arab Emirates") */
  deliveryPortExWork: string | null;
  /** General remarks or terms from top of sheet */
  generalRemarks: string | null;
};

type ParsedQuoteResult = ParsedQuoteItem[] & {
  metadata?: ParsedQuoteMetadata;
};

/**
 * Generate Excel file with locked cells for quote request
 * Only yellow cells (Unit Price, Total Price, Delivery Time) are editable
 */
export async function generateQuoteRequestExcelWithLockedCells(data: QuoteRequestData): Promise<Buffer> {
  const { requisition, vendorName, validUntil, customMessage } = data;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Quote Request');

  // Add header
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'QUOTE REQUEST';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Add requisition details
  let currentRow = 3;
  worksheet.getCell(`A${currentRow}`).value = 'Vendor Name:';
  worksheet.getCell(`B${currentRow}`).value = vendorName;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Requisition Number:';
  worksheet.getCell(`B${currentRow}`).value = requisition.requisitionNumber;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Manual Req Number:';
  worksheet.getCell(`B${currentRow}`).value = requisition.manualReqNumber || 'N/A';
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Requisition Type:';
  worksheet.getCell(`B${currentRow}`).value = requisition.requisitionType;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Heading:';
  worksheet.getCell(`B${currentRow}`).value = requisition.heading;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Description:';
  worksheet.getCell(`B${currentRow}`).value = requisition.description || 'N/A';
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Port of Supply:';
  worksheet.getCell(`B${currentRow}`).value = requisition.portOfSupply || 'N/A';
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Vessel Name:';
  worksheet.getCell(`B${currentRow}`).value = requisition.vessel.name;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Vessel Code:';
  worksheet.getCell(`B${currentRow}`).value = requisition.vessel.code || 'N/A';
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Created By:';
  worksheet.getCell(`B${currentRow}`).value = `${requisition.createdBy.firstName} ${requisition.createdBy.lastName}`;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Date of Creation:';
  worksheet.getCell(`B${currentRow}`).value = new Date(requisition.dateOfCreation).toLocaleDateString();
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = 'Quote Valid Until:';
  worksheet.getCell(`B${currentRow}`).value = validUntil.toLocaleDateString();
  currentRow += 2;

  // Add instructions
  worksheet.getCell(`A${currentRow}`).value = 'INSTRUCTIONS:';
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = '1. Please fill in ONLY the YELLOW highlighted cells';
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = '2. Yellow cells: Unit Price, Total Price, Delivery Time';
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = '3. All other cells are locked and cannot be edited';
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = '4. Save and return this file via email';
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = '5. Quote must be received before the valid until date';
  currentRow += 2;

  // Add header row for items
  const headerRow = currentRow;
  const headers = ['Item Name', 'Description', 'Quantity', 'Unit', 'Urgency', 'Remarks', 'Unit Price', 'Total Price', 'Delivery Time'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: EXCEL_THEME.TABLE_HEADER_ALT,
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.protection = { locked: true }; // Lock header cells
  });
  currentRow++;

  // Add items
  requisition.items.forEach((item) => {
    const row = worksheet.getRow(currentRow);
    
    // Locked cells (read-only)
    row.getCell(1).value = item.itemName;
    row.getCell(1).protection = { locked: true };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    row.getCell(2).value = item.description || '';
    row.getCell(2).protection = { locked: true };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    row.getCell(3).value = Number(item.quantity);
    row.getCell(3).protection = { locked: true };
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    row.getCell(4).value = item.unit;
    row.getCell(4).protection = { locked: true };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    row.getCell(5).value = item.urgency;
    row.getCell(5).protection = { locked: true };
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    row.getCell(6).value = item.remarks || '';
    row.getCell(6).protection = { locked: true };
    row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.TABLE_HEADER_ALT };

    // Editable cells (yellow, unlocked)
    row.getCell(7).value = ''; // Unit Price
    row.getCell(7).protection = { locked: false };
    row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.DATA_LOCKED }; // Yellow
    row.getCell(7).numFmt = '#,##0.00'; // Number format

    row.getCell(8).value = ''; // Total Price
    row.getCell(8).protection = { locked: false };
    row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.DATA_LOCKED }; // Yellow
    row.getCell(8).numFmt = '#,##0.00'; // Number format

    row.getCell(9).value = ''; // Delivery Time
    row.getCell(9).protection = { locked: false };
    row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: EXCEL_THEME.DATA_LOCKED }; // Yellow

    currentRow++;
  });

  // Set column widths
  worksheet.columns = [
    { width: 30 }, // Item Name
    { width: 40 }, // Description
    { width: 12 }, // Quantity
    { width: 10 }, // Unit
    { width: 12 }, // Urgency
    { width: 30 }, // Remarks
    { width: 15 }, // Unit Price
    { width: 15 }, // Total Price
    { width: 15 }, // Delivery Time
  ];

  // Protect worksheet (locked cells cannot be edited, unlocked cells can)
  await worksheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseQuoteResponseExcel(buffer: any): Promise<ParsedQuoteResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('Worksheet not found');
  }

  const templateHeader = detectActiniumQuoteHeaderRow(worksheet);

  let headerRow = 0;
  const columnMap: Record<string, number> = {};
  let enforceSerialSequence = false;
  let serialColumn = 1;
  const useTemplateLayout = !!templateHeader;

  if (templateHeader) {
    headerRow = templateHeader.headerRow;
    enforceSerialSequence = true;
    serialColumn = templateHeader.serialColumn;
    const cm = templateHeader.columnMap;
    const primaryNameCol =
      cm.oilGrade ?? cm.paintProduct ?? cm.partName ?? cm.itemName;
    if (primaryNameCol) columnMap['itemName'] = primaryNameCol;
    if (cm.partNumber) columnMap['partNumber'] = cm.partNumber;
    if (cm.impaCode) columnMap['impaCode'] = cm.impaCode;
    if (cm.drawingNumber) columnMap['drawingNumber'] = cm.drawingNumber;
    if (cm.description) columnMap['description'] = cm.description;
    if (cm.machinery) columnMap['machinery'] = cm.machinery;
    if (cm.quantity) columnMap['quantity'] = cm.quantity;
    if (cm.unit) columnMap['unit'] = cm.unit;
    if (cm.urgency) columnMap['urgency'] = cm.urgency;
    if (cm.remarks) columnMap['remarks'] = cm.remarks;
    if (cm.unitPriceUsd) columnMap['priceUsd'] = cm.unitPriceUsd;
    if (cm.unitPriceCurrency) columnMap['priceCurrency'] = cm.unitPriceCurrency;
    if (cm.discount) columnMap['discount'] = cm.discount;
    if (cm.totalPrice) columnMap['total'] = cm.totalPrice;
    if (cm.deliveryTime) columnMap['deliveryTime'] = cm.deliveryTime;
  } else {
    for (let i = 1; i <= Math.min(60, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const hA = row.getCell(1).value?.toString().trim().toLowerCase() || '';
      const hB = row.getCell(2).value?.toString().trim().toLowerCase() || '';
      const hC = row.getCell(3).value?.toString().trim().toLowerCase() || '';
      const hD = row.getCell(4).value?.toString().trim().toLowerCase() || '';
      const hE = row.getCell(5).value?.toString().trim().toLowerCase() || '';
      const hF = row.getCell(6).value?.toString().trim().toLowerCase() || '';
      const hG = row.getCell(7).value?.toString().trim().toLowerCase() || '';
      const hH = row.getCell(8).value?.toString().trim().toLowerCase() || '';
      const hI = row.getCell(9).value?.toString().trim().toLowerCase() || '';
      const hJ = row.getCell(10).value?.toString().trim().toLowerCase() || '';
      const hK = row.getCell(11).value?.toString().trim().toLowerCase() || '';
      const hL = row.getCell(12).value?.toString().trim().toLowerCase() || '';
      const hM = row.getCell(13).value?.toString().trim().toLowerCase() || '';
      const hN = row.getCell(14).value?.toString().trim().toLowerCase() || '';

      const isFullSpareHeaderRow =
        (hA === 's.no.' || hA === 's.no' || hA === 'sno' || hA === 's. no.') &&
        hB === 'item name' &&
        (hC === 'part number' || hC === 'part no.' || hC === 'part no') &&
        (hD === 'drawing number' || hD === 'drawing no.' || hD === 'drawing no') &&
        hE === 'description' &&
        (hF === 'quantity' || hF === 'qty' || hF === 'req qty') &&
        hG === 'unit' &&
        hH === 'urgency' &&
        hI === 'remarks' &&
        (hJ === 'unit price (usd)' || hJ === 'unit price usd' || hJ === 'unit price') &&
        (hK === 'unit price (selected currency)' || hK === 'unit price (selected)' || hK.includes('selected')) &&
        (hL === 'discount (%)' || hL === 'discount(%)' || hL === 'discount %' || hL === 'discount' || hL === 'disc. %') &&
        (hM === 'total price' || hM === 'total') &&
        hN === 'delivery time';

      const isStoreHeaderRow =
        (hA === 's.no.' || hA === 's.no' || hA === 'sno' || hA === 's. no.') &&
        hB === 'item name' &&
        (hC === 'impa code' || hC.includes('impa')) &&
        hD === 'description' &&
        (hE === 'quantity' || hE === 'qty' || hE === 'req qty') &&
        hF === 'unit' &&
        hG === 'urgency' &&
        hH === 'remarks' &&
        (hI === 'unit price (usd)' || hI === 'unit price usd' || hI === 'unit price') &&
        (hJ === 'unit price (selected currency)' || hJ === 'unit price (selected)' || hJ.includes('selected')) &&
        (hK === 'discount (%)' || hK === 'discount(%)' || hK === 'discount %' || hK === 'discount' || hK === 'disc. %') &&
        (hL === 'total price' || hL === 'total') &&
        hM === 'delivery time';

      const isLegacyFixedHeaderRow =
        (hA === 's.no.' || hA === 's.no' || hA === 'sno' || hA === 's. no.') &&
        hB === 'item name' &&
        hC === 'part number' &&
        hD === 'drawing number' &&
        hE === 'description' &&
        (hF === 'quantity' || hF === 'qty' || hF === 'req qty') &&
        hG === 'unit' &&
        hH === 'urgency' &&
        hI === 'remarks' &&
        (hJ === 'unit price (usd)' || hJ === 'unit price usd' || hJ === 'unit price') &&
        hK === 'unit price (selected currency)' &&
        (hL === 'discount (%)' || hL === 'discount(%)' || hL === 'discount %' || hL === 'discount') &&
        (hM === 'total price' || hM === 'total') &&
        hN === 'delivery time';

      if (isFullSpareHeaderRow || isLegacyFixedHeaderRow) {
        headerRow = i;
        columnMap['itemName'] = 2;
        columnMap['partNumber'] = 3;
        columnMap['drawingNumber'] = 4;
        columnMap['description'] = 5;
        columnMap['quantity'] = 6;
        columnMap['unit'] = 7;
        columnMap['urgency'] = 8;
        columnMap['remarks'] = 9;
        columnMap['priceUsd'] = 10;
        columnMap['priceCurrency'] = 11;
        columnMap['discount'] = 12;
        columnMap['total'] = 13;
        columnMap['deliveryTime'] = 14;
        enforceSerialSequence = true;
        serialColumn = 1;
        break;
      }

      if (isStoreHeaderRow) {
        headerRow = i;
        columnMap['itemName'] = 2;
        columnMap['description'] = 4;
        columnMap['quantity'] = 5;
        columnMap['unit'] = 6;
        columnMap['urgency'] = 7;
        columnMap['remarks'] = 8;
        columnMap['priceUsd'] = 9;
        columnMap['priceCurrency'] = 10;
        columnMap['discount'] = 11;
        columnMap['total'] = 12;
        columnMap['deliveryTime'] = 13;
        enforceSerialSequence = true;
        serialColumn = 1;
        break;
      }
    }

    for (let i = 1; i <= Math.min(60, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      let foundItemName = false;

      row.eachCell((cell, colNumber) => {
        if (!cell.value) return;
        const cellText = cell.value.toString().toLowerCase().trim();

        if (cellText === 's.no.' || cellText === 's.no' || cellText === 'sno' || cellText === 's. no.' || cellText === '#') {
          serialColumn = colNumber;
        } else if (cellText === 'item name') {
          foundItemName = true;
          columnMap['itemName'] = colNumber;
        } else if (cellText === 'quantity' || cellText === 'req qty') {
          columnMap['quantity'] = colNumber;
        } else if (cellText === 'part number' || cellText === 'part no.' || cellText === 'part no') {
          columnMap['partNumber'] = colNumber;
        } else if (cellText === 'drawing number' || cellText === 'drawing no.' || cellText === 'drawing no') {
          columnMap['drawingNumber'] = colNumber;
        } else if (cellText === 'impa code' || cellText.includes('impa')) {
          columnMap['impaCode'] = colNumber;
        } else if (cellText === 'description') {
          columnMap['description'] = colNumber;
        } else if (cellText === 'unit') {
          columnMap['unit'] = colNumber;
        } else if (cellText === 'urgency') {
          columnMap['urgency'] = colNumber;
        } else if (cellText === 'remarks') {
          columnMap['remarks'] = colNumber;
        } else if (cellText === 'unit price (usd)' || cellText === 'unit price' || cellText === 'unit price usd') {
          columnMap['priceUsd'] = colNumber;
        } else if (cellText === 'unit price (selected currency)' || cellText === 'unit price (selected)' || (cellText.includes('unit price') && cellText.includes('selected'))) {
          columnMap['priceCurrency'] = colNumber;
        } else if (cellText === 'discount (%)' || cellText === 'discount' || cellText === 'discount%' || cellText === 'disc. %') {
          columnMap['discount'] = colNumber;
        } else if (cellText === 'total price' || cellText === 'total') {
          columnMap['total'] = colNumber;
        } else if (cellText === 'delivery time') {
          columnMap['deliveryTime'] = colNumber;
        }
      });

      if (foundItemName && headerRow === 0) {
        headerRow = i;
        enforceSerialSequence = serialColumn > 0;
        break;
      }
    }

    if (headerRow === 0) {
      for (let i = 1; i <= Math.min(50, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        const firstCell = normalizeHeaderLabel(row.getCell(1).value);
        if (!firstCell.includes('s no') && firstCell !== 'sno' && firstCell !== '#') {
          continue;
        }

        let matchedHeaders = 0;
        row.eachCell((cell, colNumber) => {
          if (!cell.value) return;
          const text = cell.value.toString().toLowerCase().trim();

          if (!columnMap['itemName'] && (text === 'item name' || text === 'oil grade' || text === 'product name' || text === 'part name')) {
            columnMap['itemName'] = colNumber;
            matchedHeaders++;
          } else if (!columnMap['quantity'] && (text.includes('quantity') || text.startsWith('qty'))) {
            columnMap['quantity'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['unit'] &&
            (text === 'unit' || text === 'uom' || text.includes('unit of measure') || text.includes('unit of measurement'))
          ) {
            columnMap['unit'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['priceUsd'] &&
            (text.includes('unit price usd') || (text.includes('unit price') && text.includes('usd')))
          ) {
            columnMap['priceUsd'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['priceCurrency'] &&
            text.includes('unit price') &&
            !text.includes('usd')
          ) {
            columnMap['priceCurrency'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['discount'] &&
            text.includes('discount')
          ) {
            columnMap['discount'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['total'] &&
            text.includes('total price')
          ) {
            columnMap['total'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['remarks'] &&
            text === 'remarks'
          ) {
            columnMap['remarks'] = colNumber;
            matchedHeaders++;
          } else if (
            !columnMap['deliveryTime'] &&
            (text.includes('delivery time') || text.includes('lead time'))
          ) {
            columnMap['deliveryTime'] = colNumber;
            matchedHeaders++;
          }
        });

        if (matchedHeaders >= 4) {
          headerRow = i;
          enforceSerialSequence = true;
          serialColumn = 1;
          break;
        }
      }
    }
  }

  if (headerRow === 0 || !columnMap['itemName']) {
    throw new Error('Could not find vendor quote item table header row');
  }

  if (!useTemplateLayout && !enforceSerialSequence && headerRow > 0) {
    const row = worksheet.getRow(headerRow);
    row.eachCell((cell, colNumber) => {
      if (!cell.value) return;
      const headerText = cell.value.toString().trim().toLowerCase();
      if (headerText === 's.no.' || headerText === 's.no' || headerText === 'sno' || headerText === 's. no.' || headerText === '#') {
        serialColumn = colNumber;
        enforceSerialSequence = true;
      }
    });
  }

  const items: ParsedQuoteItem[] = [];

  const metadata: ParsedQuoteMetadata = {
    vendorRfqNumber: null,
    contactPersonEmail: null,
    mobile: null,
    leadTime: null,
    supplyTerms: null,
    paymentTerms: null,
    grossTotalBeforeDiscount: null,
    netTotalAfterDiscount: null,
    quotationReference: null,
    validityPeriod: null,
    deliveryPortExWork: null,
    generalRemarks: null,
  };

  for (let i = 1; i <= Math.min(50, worksheet.rowCount); i++) {
    const row = worksheet.getRow(i);
    row.eachCell((cell, colNumber) => {
      if (!cell.value) return;
      const rawText = cell.value.toString().trim();
      const text = rawText.toLowerCase().replace(/:/g, '');

      if (!metadata.vendorRfqNumber && (text.includes('vendor rfq number') || text.includes('vendor rfq no'))) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.vendorRfqNumber = v.toString().trim();
        }
      } else if (!metadata.contactPersonEmail && text.includes('contact person email')) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.contactPersonEmail = v.toString().trim();
        }
      } else if (!metadata.mobile && text === 'mobile') {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.mobile = v.toString().trim();
        }
      } else if (!metadata.leadTime && (text.includes('lead time') || text.includes('delivery lead time'))) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.leadTime = v.toString().trim();
        }
      } else if (!metadata.supplyTerms && text.includes('supply terms')) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.supplyTerms = v.toString().trim();
        }
      } else if (!metadata.paymentTerms && text.includes('payment terms')) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.paymentTerms = v.toString().trim();
        }
      } else if (!metadata.quotationReference && (text.includes('quotation reference') || text.includes('quote reference') || text.includes('quotation ref'))) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.quotationReference = v.toString().trim();
        }
      } else if (!metadata.validityPeriod && text.includes('validity period')) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.validityPeriod = v.toString().trim();
        }
      } else if (!metadata.deliveryPortExWork && (text.includes('delivery port') || text.includes('ex-work') || text.includes('ex work'))) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.deliveryPortExWork = v.toString().trim();
        }
      } else if (!metadata.generalRemarks && i <= 15 && (text === 'remarks' || text.includes('terms and conditions') || text.includes('general remarks'))) {
        const v = row.getCell(colNumber + 1).value;
        if (v) {
          metadata.generalRemarks = v.toString().trim();
        }
      }
    });
  }

  let leadTime: string | null = metadata.leadTime;
  if (!leadTime) {
    for (let i = headerRow + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const cellA = row.getCell(1).value;
      if (cellA && cellA.toString().toLowerCase().trim() === 'lead time') {
        const val = row.getCell(2).value;
        if (val) {
          leadTime = val.toString();
        }
        break;
      }
    }
  }

  metadata.leadTime = leadTime;

  let grossTotalBeforeDiscount: number | null = null;
  let netTotalAfterDiscount: number | null = null;

  for (let i = 1; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    let hasGrossLabel = false;
    let hasNetLabel = false;

    row.eachCell((cell) => {
      if (!cell.value) return;
      const rawText = cell.value.toString();
      const text = rawText.toLowerCase().trim();
      const compact = text.replace(/\s+/g, '');

      if (
        compact.includes('finalgrosstotal') &&
        compact.includes('beforediscount')
      ) {
        hasGrossLabel = true;
      }

      if (
        compact.includes('finalnettotal') &&
        compact.includes('afterdiscount')
      ) {
        hasNetLabel = true;
      }
    });

    if (hasGrossLabel && grossTotalBeforeDiscount === null) {
      const priceCol = columnMap["priceCurrency"] ?? 11;
      const val = getNumericValue(row.getCell(priceCol).value);
      if (val !== null) {
        grossTotalBeforeDiscount = val;
      }
    }

    if (hasNetLabel && netTotalAfterDiscount === null) {
      const totalCol = columnMap["total"] ?? 13;
      const val = getNumericValue(row.getCell(totalCol).value);
      if (val !== null) {
        netTotalAfterDiscount = val;
      }
    }

    if (
      grossTotalBeforeDiscount !== null &&
      netTotalAfterDiscount !== null
    ) {
      break;
    }
  }

  metadata.grossTotalBeforeDiscount = grossTotalBeforeDiscount;
  metadata.netTotalAfterDiscount = netTotalAfterDiscount;

  let expectedSerial: number | null = enforceSerialSequence ? 1 : null;

  for (let i = headerRow + 1; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);

    if (useTemplateLayout && isQuoteItemDataTerminatorRow(row)) {
      break;
    }

    let currentLineNumber: number | null = null;

    if (enforceSerialSequence && expectedSerial !== null) {
      const serialCell = row.getCell(serialColumn).value;

      if (serialCell === null || serialCell === undefined || serialCell === '') {
        break;
      }

      let serialNumber: number | null = null;

      if (typeof serialCell === 'number') {
        serialNumber = serialCell;
      } else {
        const parsed = parseInt(serialCell.toString().trim(), 10);
        if (!Number.isNaN(parsed)) {
          serialNumber = parsed;
        }
      }

      if (serialNumber === null || serialNumber !== expectedSerial) {
        break;
      }

      currentLineNumber = serialNumber;
      expectedSerial = expectedSerial + 1;
    }

    const itemNameIdx = columnMap['itemName'];
    if (!itemNameIdx) continue;

    const itemNameRaw = useTemplateLayout && templateHeader
      ? getPrimaryItemLabelFromRow(
          row,
          templateHeader.columnMap,
          templateHeader.layoutId,
          templateHeader.requisitionType ?? undefined
        )
      : row.getCell(itemNameIdx).value;

    const itemNameText = String(itemNameRaw ?? '').trim();
    if (!itemNameText) {
      const cellA = row.getCell(1).value;
      let hasTotalLabel = false;
      row.eachCell((cell) => {
        if (!cell.value) return;
        const text = cell.value.toString();
        if (text.includes('Gross Total') || text.includes('Discount')) {
          hasTotalLabel = true;
        }
      });
      if ((cellA && (cellA.toString().includes('Gross Total') || cellA.toString().includes('Discount'))) || hasTotalLabel) {
        break;
      }
      continue;
    }

    if (
      useTemplateLayout &&
      (isSerialHeader(normalizeHeaderLabel(itemNameText)) ||
        itemNameText.toLowerCase().includes('vendor & vessel') ||
        itemNameText.toLowerCase().includes('item details'))
    ) {
      continue;
    }

    const partNumberIdx = columnMap['partNumber'];
    const impaCodeIdx = columnMap['impaCode'];
    const drawingNumberIdx = columnMap['drawingNumber'];
    const descriptionIdx = columnMap['description'];
    const machineryIdx = columnMap['machinery'];
    const qtyIdx = columnMap['quantity'];
    const unitIdx = columnMap['unit'];
    const urgencyIdx = columnMap['urgency'];
    const remarksIdx = columnMap['remarks'];
    const priceUsdIdx = columnMap['priceUsd'];
    const priceCurrencyIdx = columnMap['priceCurrency'];
    const discountIdx = columnMap['discount'];
    const totalIdx = columnMap['total'];
    const deliveryTimeIdx = columnMap['deliveryTime'];

    const partNumber = partNumberIdx ? row.getCell(partNumberIdx).value : '';
    const impaCode = impaCodeIdx ? row.getCell(impaCodeIdx).value : '';
    const partOrImpa = String(partNumber || impaCode || '').trim();
    const drawingNumber = drawingNumberIdx ? row.getCell(drawingNumberIdx).value : '';
    let description = descriptionIdx ? row.getCell(descriptionIdx).value : '';
    if (machineryIdx) {
      const machinery = row.getCell(machineryIdx).value;
      const machineryText = String(machinery ?? '').trim();
      if (machineryText) {
        description = description
          ? `${String(description).trim()} | Machinery: ${machineryText}`
          : machineryText;
      }
    }
    const reqQty = qtyIdx ? row.getCell(qtyIdx).value : 0;
    const unit = unitIdx ? row.getCell(unitIdx).value : (useTemplateLayout ? 'L' : '');
    const urgency = urgencyIdx ? row.getCell(urgencyIdx).value : 'NORMAL';
    const remarks = remarksIdx ? row.getCell(remarksIdx).value : '';
    
    const unitPriceUsdRaw = priceUsdIdx ? row.getCell(priceUsdIdx).value : null;
    const unitPriceCurrencyRaw = priceCurrencyIdx ? row.getCell(priceCurrencyIdx).value : null;
    const discountRaw = discountIdx ? row.getCell(discountIdx).value : 0;
    const totalRaw = totalIdx ? row.getCell(totalIdx).value : null;
    const rowDeliveryTime = deliveryTimeIdx ? row.getCell(deliveryTimeIdx).value : null;

    let unitPrice: number | null = null;
    const unitPriceCurrency = getNumericValue(unitPriceCurrencyRaw);
    const unitPriceUsd = getNumericValue(unitPriceUsdRaw);

    if (unitPriceCurrency !== null) {
      unitPrice = unitPriceCurrency;
    } else if (unitPriceUsd !== null) {
      unitPrice = unitPriceUsd;
    }

    let totalPrice: number | null = getNumericValue(totalRaw);

    if ((totalPrice === null || totalPrice === 0) && unitPrice !== null) {
      const qtyNum = getNumericValue(reqQty);
      const discountNum = getNumericValue(discountRaw) ?? 0;
      if (qtyNum !== null && qtyNum > 0) {
        const discountPct = discountNum / 100;
        totalPrice = qtyNum * unitPrice * (1 - discountPct);
      }
    }

    let fullDescription = String(description || '');
    if (partOrImpa && !fullDescription.includes(partOrImpa)) {
      fullDescription = fullDescription ? `${fullDescription} (IMPA: ${partOrImpa})` : `(IMPA: ${partOrImpa})`;
    }
    if (drawingNumber) fullDescription += ` (Drawing: ${drawingNumber})`;

    const lineNumber = currentLineNumber ?? items.length + 1;

    items.push({
      itemName: itemNameText,
      description: fullDescription.trim(),
      quantity: getNumericValue(reqQty) ?? 0,
      unit: String(unit || ''),
      urgency: String(urgency || 'NORMAL'),
      remarks: String(remarks || ''),
      unitPrice,
      totalPrice,
      deliveryTime: rowDeliveryTime ? String(rowDeliveryTime) : leadTime,
      lineNumber,
      partNumber: partOrImpa || null,
    });
  }

  const result = items as ParsedQuoteResult;
  result.metadata = metadata;
  return result;
}
