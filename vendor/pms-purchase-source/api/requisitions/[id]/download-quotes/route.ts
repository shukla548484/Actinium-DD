import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { jsPDF } from 'jspdf';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to draw a box/rectangle
 */
function drawBox(pdf: jsPDF, x: number, y: number, width: number, height: number, lineWidth: number = 0.5) {
  pdf.setLineWidth(lineWidth);
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(x, y, width, height);
}

/**
 * Helper function to add a section with box
 */
function addBoxedSection(
  pdf: jsPDF,
  title: string,
  data: Array<[string, string]>,
  x: number,
  y: number,
  width: number
): number {
  const titleHeight = 8;
  const padding = 3;
  const lineHeight = 6;
  const contentStartY = y + titleHeight + padding;
  
  // Calculate content height (using smaller line spacing)
  let contentHeight = padding;
  data.forEach(([label, value]) => {
    const textLines = pdf.splitTextToSize(String(value || 'N/A'), width - 40);
    contentHeight += Math.max(lineHeight, textLines.length * 4) + 2;
  });
  contentHeight += padding;
  
  const totalHeight = titleHeight + contentHeight;
  
  // Draw box
  drawBox(pdf, x, y, width, totalHeight);
  
  // Add title (reduced font)
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text(title, x + padding, y + titleHeight);
  
  // Add content (reduced font)
  pdf.setFontSize(8);
  let currentY = contentStartY;
  data.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, x + padding, currentY);
    pdf.setFont('helvetica', 'normal');
    const textLines = pdf.splitTextToSize(String(value || 'N/A'), width - 40);
    pdf.text(textLines, x + padding + 35, currentY);
    currentY += Math.max(lineHeight, textLines.length * 4) + 2;
  });
  
  return y + totalHeight + 5;
}

const TABLE_FONT_SIZE = 7;
const CELL_PAD = 2;
const MIN_ROW_HEIGHT = 5;

/**
 * Draw a table with text wrapping so full content is visible. Uses smaller font and variable row height.
 */
function drawTable(
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  colWidths: number[]
): number {
  const headerHeight = 6;
  const lineWidth = 0.3;
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);

  pdf.setFontSize(TABLE_FONT_SIZE);

  // Compute wrapped lines and row heights for each row
  const rowHeights: number[] = [];
  const wrappedRows: string[][][] = [];
  for (const row of rows) {
    const cellLines: string[][] = [];
    let maxLines = 1;
    for (let c = 0; c < row.length; c++) {
      const w = Math.max(colWidths[c] - CELL_PAD * 2, 5);
      const lines = pdf.splitTextToSize(String(row[c] ?? ''), w);
      cellLines.push(lines);
      maxLines = Math.max(maxLines, lines.length);
    }
    wrappedRows.push(cellLines);
    rowHeights.push(Math.max(MIN_ROW_HEIGHT, maxLines * (TABLE_FONT_SIZE * 0.35 + 1)));
  }

  const totalBodyHeight = rowHeights.reduce((a, b) => a + b, 0);
  const totalTableHeight = headerHeight + totalBodyHeight;

  drawBox(pdf, x, y, tableWidth, totalTableHeight, 0.5);
  pdf.setFillColor(240, 240, 240);
  pdf.rect(x, y, tableWidth, headerHeight, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  let currentX = x;
  headers.forEach((header, index) => {
    const headerLines = pdf.splitTextToSize(header, colWidths[index] - CELL_PAD * 2);
    pdf.text(headerLines[0] || header, currentX + CELL_PAD, y + headerHeight - 2);
    if (index < headers.length - 1) {
      pdf.setLineWidth(lineWidth);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(currentX + colWidths[index], y, currentX + colWidths[index], y + totalTableHeight);
    }
    currentX += colWidths[index];
  });
  pdf.setLineWidth(lineWidth);
  pdf.setDrawColor(200, 200, 200);
  pdf.line(x, y + headerHeight, x + tableWidth, y + headerHeight);

  pdf.setFont('helvetica', 'normal');
  let currentY = y + headerHeight;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const rowHeight = rowHeights[rowIndex];
    const cellLines = wrappedRows[rowIndex];
    currentX = x;
    for (let cellIndex = 0; cellIndex < cellLines.length; cellIndex++) {
      const lines = cellLines[cellIndex];
      const colW = colWidths[cellIndex];
      const lineHeight = TABLE_FONT_SIZE * 0.35 + 0.5;
      let lineY = currentY + lineHeight;
      for (const line of lines) {
        pdf.text(line, currentX + CELL_PAD, lineY);
        lineY += lineHeight;
      }
      if (cellIndex < cellLines.length - 1) {
        pdf.setLineWidth(lineWidth);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(currentX + colW, currentY, currentX + colW, currentY + rowHeight);
      }
      currentX += colW;
    }
    if (rowIndex < rows.length - 1) {
      pdf.setLineWidth(lineWidth);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(x, currentY + rowHeight, x + tableWidth, currentY + rowHeight);
    }
    currentY += rowHeight;
  }

  return currentY + 5;
}

/**
 * GET /api/requisitions/[id]/download-quotes - Generate combined PDF of all quotes for a requisition
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access level
    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 37, 39, 41, 44, 47, 48, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { 
          error: 'Insufficient permissions to download quotes',
          message: `Access level ${userAccessLevel} is not authorized to download quotes.`,
          userAccessLevel,
          requiredLevels: allowedLevels
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Check if user has Purchase module access
    const isAdmin = isAdminEquivalentAccessLevel(userAccessLevel);
    let hasPurchaseModule = false;

    if (isAdmin) {
      hasPurchaseModule = true;
    } else {
      const assignedModules = (currentUser as any).assignedModules || [];
      hasPurchaseModule = assignedModules.some((am: any) => {
        const moduleName = am.module?.name || am.name;
        return moduleName === 'Purchase';
      });
    }

    if (!hasPurchaseModule) {
      return NextResponse.json(
        { error: 'Access denied. Purchase module access required.' },
        { status: 403 }
      );
    }

    // Get requisition with quotes
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: true,
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        vendorQuotes: {
          where: {
            status: {
              in: ['RECEIVED', 'APPROVED'],
            },
          },
          include: {
            vendor: true,
            quotedItems: {
              orderBy: {
                itemName: 'asc',
              },
            },
          },
          orderBy: {
            totalAmount: 'asc',
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Check vessel access
    if (!isAdmin) {
      const assignedVessels = (currentUser as any).assignedVessels || [];
      const assignedVesselIds = assignedVessels
        .map((av: any) => av.vessel?.id)
        .filter((id: any): id is string => Boolean(id));
      
      if (assignedVesselIds.length > 0 && !assignedVesselIds.includes(requisition.vesselId)) {
        return NextResponse.json(
          { error: 'Access denied. You do not have access to this vessel.' },
          { status: 403 }
        );
      }
    }

    if (requisition.vendorQuotes.length === 0) {
      return NextResponse.json(
        { error: 'No quotes found for this requisition' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const leftMargin = 10;
    const rightMargin = 10;
    const usableWidth = pageWidth - leftMargin - rightMargin;
    let yPosition = 10;

    // Header with Actinium Branding (reduced font)
    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, pageWidth, 22, 'F');
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('ACTINIUM-SM', pageWidth / 2, 10, { align: 'center' });
    
    pdf.setFontSize(11);
    pdf.text('SHIP MANAGER SYSTEM', pageWidth / 2, 16, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('QUOTE COMPARISON REPORT', pageWidth / 2, 28, { align: 'center' });
    
    yPosition = 34;

    // Requisition Details Box
    const reqDetails: Array<[string, string]> = [
      ['Requisition Number:', requisition.requisitionNumber],
      ['Heading:', requisition.heading],
      ['Vessel:', requisition.vessel.name],
      ['Date:', new Date(requisition.dateOfCreation).toLocaleDateString()],
    ];
    yPosition = addBoxedSection(pdf, 'REQUISITION DETAILS', reqDetails, leftMargin, yPosition, usableWidth);

    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = 10;
    }

    // Quotes Summary Table (reduced font)
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('QUOTES SUMMARY', leftMargin, yPosition);
    yPosition += 6;

    const summaryHeaders = ['Rank', 'Vendor Name', 'Total Amount', 'Status'];
    const summaryColWidths = [12, 95, 38, 28];
    const summaryRows = requisition.vendorQuotes.map((quote, index) => [
      (index + 1).toString(),
      quote.vendor.name,
      `${quote.currency} ${quote.totalAmount ? Number(quote.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`,
      quote.status,
    ]);

    yPosition = drawTable(pdf, summaryHeaders, summaryRows, leftMargin, yPosition, summaryColWidths);
    yPosition += 10;

    // Detailed Quote Information
    requisition.vendorQuotes.forEach((quote, quoteIndex) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 120) {
        pdf.addPage();
        yPosition = 10;
      }

      // Quote Header (reduced font)
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`QUOTE ${quoteIndex + 1} - ${quote.vendor.name}`, leftMargin, yPosition);
      yPosition += 8;

      // Quote Details Box
      const quoteDetails: Array<[string, string]> = [
        ['Vendor:', quote.vendor.name],
        ['Email:', quote.vendor.primaryEmail || 'N/A'],
        ['Total Amount:', `${quote.currency} ${quote.totalAmount ? Number(quote.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`],
        ['Status:', quote.status],
        ['Received At:', quote.receivedAt ? new Date(quote.receivedAt).toLocaleString() : 'N/A'],
        ['Valid Until:', quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'],
      ];
      yPosition = addBoxedSection(pdf, 'QUOTE INFORMATION', quoteDetails, leftMargin, yPosition, usableWidth);
      yPosition += 5;

      // Quote Items Table
      if (quote.quotedItems.length > 0) {
        if (yPosition > pageHeight - 100) {
          pdf.addPage();
          yPosition = 10;
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('QUOTE ITEMS', leftMargin, yPosition);
        yPosition += 6;

        const itemHeaders = ['Item Name', 'Part No.', 'Drawing No.', 'Qty', 'Unit', 'Unit Price', 'Total Price'];
        const itemColWidths = [72, 22, 22, 12, 12, 22, 22];
        const itemRows = quote.quotedItems.map((item) => [
          item.itemName,
          item.partNumber || '-',
          item.drawingNumber || '-',
          String(item.quantity || 0),
          item.unit || '-',
          item.unitPrice ? Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
          item.totalPrice ? Number(item.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        ]);

        yPosition = drawTable(pdf, itemHeaders, itemRows, leftMargin, yPosition, itemColWidths);
        yPosition += 15;
      }
    });

    // Footer with Actinium Branding (reduced font)
    const footerY = pageHeight - 10;
    pdf.setFontSize(6);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated by Actinium-sm Ship Manager System', pageWidth / 2, footerY, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(`© ${new Date().getFullYear()} Actinium-sm. All rights reserved.`, pageWidth / 2, footerY + 4, { align: 'center' });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Quotes_${requisition.requisitionNumber}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating quotes PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate quotes PDF', details: error.message },
      { status: 500 }
    );
  }
}
