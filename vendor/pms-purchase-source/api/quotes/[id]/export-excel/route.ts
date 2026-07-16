import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import ExcelJS from 'exceljs';
import { formatCurrency as formatCurrencyUtil, convertCurrencySync } from '@/lib/utils/currency';
import {
  createBrandedWorkbook,
  addBrandedHeader,
  addBrandedFooter,
  BRAND_COLORS,
  EXCEL_THEME,
  styleHeaderRow,
} from '@/lib/excel-branding';
import { matchQuoteLineToRequisitionItem } from '@/lib/procurement/match-quote-requisition-item';
import { assignRequisitionLineNumbers } from '@/lib/procurement/requisition-line-identity';

/**
 * GET /api/quotes/[id]/export-excel
 * Export quote comparison to Excel file with auto-adjusted columns
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requisitionId = params.id;

    // Fetch quote comparison data
    const quotesResponse = await fetch(
      `${request.nextUrl.origin}/api/quotes/${requisitionId}/compare`,
      {
        headers: {
          Cookie: request.headers.get('Cookie') || '',
        },
      }
    );

    if (!quotesResponse.ok) {
      throw new Error('Failed to fetch quote comparison data');
    }

    const quotesData = await quotesResponse.json();
    const comparison = quotesData.comparison || [];
    const requisition = quotesData.requisition;

    const reqItemsForMatch = assignRequisitionLineNumbers(
      (requisition?.items ?? []).map((it: any) => ({
        id: it.id,
        itemName: it.itemName,
        impaNumber: it.impaNumber,
        itemNumber: it.itemNumber,
        partNumber: it.partNumber,
        quantity: Number(it.quantity),
        unit: it.unit,
      }))
    );

    const findQuoteItemForRequisition = (quote: any, reqItem: any) => {
      const reqLine = reqItemsForMatch.find((r) => r.id === reqItem.id);
      if (!reqLine) return undefined;
      const quoteLines = (quote.items ?? []).map((q: any, idx: number) => ({
        ...q,
        lineNumber: q.lineNumber ?? idx + 1,
      }));
      return matchQuoteLineToRequisitionItem(quoteLines, reqLine, reqItemsForMatch);
    };

    if (!requisition || !requisition.items || requisition.items.length === 0) {
      return NextResponse.json(
        { error: 'No requisition items found' },
        { status: 404 }
      );
    }

    if (comparison.length === 0) {
      return NextResponse.json(
        { error: 'No quotes available for comparison' },
        { status: 404 }
      );
    }

    // Create workbook
    const workbook = createBrandedWorkbook('Price Comparison');
    const worksheet = workbook.addWorksheet('Price Comparison');

    // Sort quotes by total amount (lowest first)
    const sortedQuotes = [...comparison].sort((a, b) => {
      const totalA = a.totalAmount ? Number(a.totalAmount) : 0;
      const totalB = b.totalAmount ? Number(b.totalAmount) : 0;
      return totalA - totalB;
    });

    // Calculate column count: 4 fixed columns + (5 columns per vendor: Remarks, Unit Price, Discounted Price, Total Price, Local Price)
    const fixedColumns = 4; // Item No., Item, Quantity, Updated Qty
    const vendorColumns = sortedQuotes.length * 5; // 5 columns per vendor
    const totalColumns = fixedColumns + vendorColumns;

    const dataStartRow = addBrandedHeader(
      worksheet,
      'PRICE COMPARISON PAGE',
      requisition?.requisitionNumber
        ? `Requisition: ${requisition.requisitionNumber}`
        : undefined,
      1,
      totalColumns
    );
    const vendorHeaderRow = dataStartRow;
    const subHeaderRow = dataStartRow + 1;
    const firstDataRow = dataStartRow + 2;

    // Header Row: Fixed columns + Vendor headers
    const headerRow2 = worksheet.getRow(vendorHeaderRow);
    headerRow2.height = 25;
    
    // Fixed column headers
    headerRow2.getCell(1).value = 'Item No.';
    headerRow2.getCell(2).value = 'Item';
    headerRow2.getCell(3).value = 'Quantity';
    headerRow2.getCell(4).value = 'Updated Qty';

    // Vendor headers (merged cells for 5 columns per vendor)
    let colIndex = 5;
    sortedQuotes.forEach((quote, index) => {
      const vendorName = quote.vendor.name;
      const startCol = colIndex;
      const endCol = colIndex + 4; // 5 columns per vendor
      
      // Merge cells for vendor name
      worksheet.mergeCells(`${getColumnLetter(startCol)}${vendorHeaderRow}:${getColumnLetter(endCol)}${vendorHeaderRow}`);
      const vendorHeaderCell = worksheet.getCell(`${getColumnLetter(startCol)}${vendorHeaderRow}`);
      vendorHeaderCell.value = vendorName;
      vendorHeaderCell.font = { bold: true, size: 12, name: 'Arial' };
      vendorHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      vendorHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: index === 0 ? EXCEL_THEME.HIGHLIGHT_BEST : EXCEL_THEME.HIGHLIGHT_ALT,
      };
      vendorHeaderCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      
      colIndex += 5;
    });

    // Header Row 3: Sub-columns (Remarks, Unit Price, Discounted Price, Total Price, Local Price for each vendor)
    const headerRow3 = worksheet.getRow(subHeaderRow);
    headerRow3.height = 20;
    
    // Fixed column headers (empty for row 3)
    headerRow3.getCell(1).value = '';
    headerRow3.getCell(2).value = '';
    headerRow3.getCell(3).value = '';
    headerRow3.getCell(4).value = '';

    // Vendor sub-columns (5 columns per vendor)
    colIndex = 5;
    sortedQuotes.forEach((quote) => {
      const columnHeaders = ['Remarks', 'Unit Price', 'Discounted Price', 'Total Price', 'Local Price'];
      
      columnHeaders.forEach((header, headerIndex) => {
        const cell = worksheet.getCell(`${getColumnLetter(colIndex + headerIndex)}${subHeaderRow}`);
        cell.value = header;
        cell.font = { bold: true, size: 11, name: 'Arial' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: EXCEL_THEME.TABLE_HEADER_ALT,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      colIndex += 5;
    });

    // Data rows
    requisition.items.forEach((item: any, itemIndex: number) => {
      const dataRow = worksheet.getRow(itemIndex + firstDataRow);
      dataRow.height = 20;

      // Fixed columns
      dataRow.getCell(1).value = itemIndex + 1;
      dataRow.getCell(2).value = item.itemName || '';
      dataRow.getCell(3).value = item.quantity || 0;
      dataRow.getCell(4).value = item.quantity || 0; // Updated Qty (same as quantity for now)

      // Format fixed columns
      [1, 2, 3, 4].forEach((col) => {
        const cell = dataRow.getCell(col);
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (col === 2) {
          // Description column - left align
          cell.alignment.horizontal = 'left';
        } else {
          // Other columns - center align
          cell.alignment.horizontal = 'center';
        }
      });

      // Vendor columns (5 columns per vendor)
      colIndex = 5;
      let lowestTotal: number | null = null;
      let lowestVendorIndex: number | null = null;

      // First pass: find lowest total
      let tempColIndex = 5;
      sortedQuotes.forEach((quote) => {
        const quoteItem = findQuoteItemForRequisition(quote, item);
        if (quoteItem && quoteItem.totalPrice) {
          const total = Number(quoteItem.totalPrice);
          if (lowestTotal === null || total < lowestTotal) {
            lowestTotal = total;
            lowestVendorIndex = tempColIndex + 3; // Total Price column (4th column, index 3)
          }
        }
        tempColIndex += 5;
      });

      // Second pass: populate data
      colIndex = 5;
      sortedQuotes.forEach((quote) => {
        const quoteItem = findQuoteItemForRequisition(quote, item);

        // Calculate discount percentage
        const calculateDiscount = (
          totalPrice: number | null,
          quantity: number,
          unitPrice: number | null
        ): number => {
          if (!totalPrice || !unitPrice || quantity === 0) return 0;
          const calculatedDiscount = 100 - (totalPrice * 100 / (quantity * unitPrice));
          return Math.max(0, Math.min(100, calculatedDiscount));
        };

        const discount = quoteItem ? calculateDiscount(
          quoteItem.totalPrice,
          quoteItem.quantity,
          quoteItem.unitPrice
        ) : 0;

        const discountedUnitPrice = quoteItem?.unitPrice 
          ? quoteItem.unitPrice * (1 - discount / 100) 
          : null;

        // Column 1: Remarks
        const remarksCell = worksheet.getCell(`${getColumnLetter(colIndex)}${itemIndex + firstDataRow}`);
        remarksCell.value = quoteItem?.itemRemarks || quoteItem?.remarks || '-';
        remarksCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        remarksCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Column 2: Unit Price
        const unitPriceCell = worksheet.getCell(`${getColumnLetter(colIndex + 1)}${itemIndex + firstDataRow}`);
        if (quoteItem && quoteItem.unitPrice !== null && quoteItem.unitPrice !== undefined) {
          unitPriceCell.value = Number(quoteItem.unitPrice);
          unitPriceCell.numFmt = '#,##0.00'; // Currency format
        } else {
          unitPriceCell.value = '-';
        }
        unitPriceCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        unitPriceCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Column 3: Discounted Price
        const discountedPriceCell = worksheet.getCell(`${getColumnLetter(colIndex + 2)}${itemIndex + firstDataRow}`);
        if (discountedUnitPrice !== null) {
          discountedPriceCell.value = Number(discountedUnitPrice);
          discountedPriceCell.numFmt = '#,##0.00'; // Currency format
        } else {
          discountedPriceCell.value = '-';
        }
        discountedPriceCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        discountedPriceCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Column 4: Total Price
        const totalPriceCell = worksheet.getCell(`${getColumnLetter(colIndex + 3)}${itemIndex + firstDataRow}`);
        if (quoteItem && quoteItem.totalPrice !== null && quoteItem.totalPrice !== undefined) {
          const total = Number(quoteItem.totalPrice);
          totalPriceCell.value = total;
          totalPriceCell.numFmt = '#,##0.00'; // Currency format
          
          // Highlight lowest total
          if (colIndex + 3 === lowestVendorIndex) {
            totalPriceCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: EXCEL_THEME.SECTION_TITLE,
            };
          }
        } else {
          totalPriceCell.value = '-';
        }
        totalPriceCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        totalPriceCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Column 5: Local Price
        const localPriceCell = worksheet.getCell(`${getColumnLetter(colIndex + 4)}${itemIndex + firstDataRow}`);
        if (quoteItem && quoteItem.totalPrice !== null && quoteItem.totalPrice !== undefined) {
          const baseAmount = Number(quoteItem.totalPrice);
          const localCurrency = quote.localCurrency || quote.currency;
          const localAmount = convertCurrencySync(baseAmount, quote.currency, localCurrency);
          localPriceCell.value = Number(localAmount);
          localPriceCell.numFmt = '#,##0.00'; // Currency format
        } else {
          localPriceCell.value = '-';
        }
        localPriceCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        localPriceCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        colIndex += 5;
      });
    });

    // Auto-adjust column widths with optimal sizing
    worksheet.columns.forEach((column, index) => {
      if (index === 0) {
        // Item No. column
        column.width = 12;
      } else if (index === 1) {
        // Item column - wider for long item names
        column.width = 40;
      } else if (index === 2 || index === 3) {
        // Quantity and Updated Qty columns
        column.width = 15;
      } else {
        // Vendor columns - determine which column type
        const vendorColIndex = (index - 4) % 5;
        if (vendorColIndex === 0) {
          // Remarks column
          column.width = 20;
        } else if (vendorColIndex === 1 || vendorColIndex === 2 || vendorColIndex === 3 || vendorColIndex === 4) {
          // Unit Price, Discounted Price, Total Price, Local Price columns
          column.width = 18;
        }
      }
    });

    // Enable auto-filter on header row
    addBrandedFooter(
      worksheet,
      { generatedAt: new Date() },
      requisition.items.length + firstDataRow + 2,
      totalColumns
    );

    worksheet.autoFilter = {
      from: { row: vendorHeaderRow, column: 1 },
      to: { row: subHeaderRow, column: totalColumns },
    };

    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 4,
        ySplit: subHeaderRow,
        topLeftCell: `E${firstDataRow}`,
        activeCell: `E${firstDataRow}`,
      },
    ];

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Generate filename
    const requisitionNumber = requisition.requisitionNumber || requisitionId;
    const filename = `Price_Comparison_${requisitionNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exporting quote comparison to Excel:', error);
    return NextResponse.json(
      {
        error: 'Failed to export quote comparison',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to convert column number to letter (1 = A, 2 = B, etc.)
 */
function getColumnLetter(columnNumber: number): string {
  let result = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return result;
}
