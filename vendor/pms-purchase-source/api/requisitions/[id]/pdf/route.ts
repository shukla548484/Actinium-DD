import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { jsPDF } from 'jspdf';
import { RequisitionItem } from '@/lib/types/requisition';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Actinium navy used across branded PDF headers */
const THEME = {
  navy: [30, 64, 175] as const,
  navyDark: [23, 48, 140] as const,
  navyLight: [219, 228, 255] as const,
  slate: [51, 65, 85] as const,
  muted: [100, 116, 139] as const,
  border: [191, 204, 230] as const,
  rowAlt: [245, 248, 255] as const,
  white: [255, 255, 255] as const,
  black: [15, 23, 42] as const,
};

function setRgb(
  pdf: jsPDF,
  kind: 'fill' | 'draw' | 'text',
  rgb: readonly [number, number, number]
) {
  if (kind === 'fill') pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  else if (kind === 'draw') pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function formatAddress(address: string | null | undefined): string[] {
  if (!address?.trim()) return [];
  return address
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function drawFieldPair(
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
): number {
  const labelWidth = 32;
  const valueWidth = Math.max(20, width - labelWidth - 2);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setRgb(pdf, 'text', THEME.navy);
  pdf.text(label, x, y);

  pdf.setFont('helvetica', 'normal');
  setRgb(pdf, 'text', THEME.slate);
  const lines = pdf.splitTextToSize(String(value || 'N/A'), valueWidth);
  pdf.text(lines, x + labelWidth, y);
  return Math.max(5.5, lines.length * 4.2);
}

/**
 * Two-column key/value detail card with Actinium styling.
 */
function drawTwoColumnDetails(
  pdf: jsPDF,
  title: string,
  left: Array<[string, string]>,
  right: Array<[string, string]>,
  x: number,
  y: number,
  width: number
): number {
  const titleHeight = 8;
  const padding = 4;
  const colGap = 6;
  const colWidth = (width - padding * 2 - colGap) / 2;
  const leftX = x + padding;
  const rightX = x + padding + colWidth + colGap;

  // Measure content height
  pdf.setFontSize(8);
  const measureCol = (rows: Array<[string, string]>) => {
    let h = 0;
    for (const [, value] of rows) {
      const lines = pdf.splitTextToSize(String(value || 'N/A'), colWidth - 34);
      h += Math.max(5.5, lines.length * 4.2) + 1.5;
    }
    return h;
  };
  const contentHeight = Math.max(measureCol(left), measureCol(right)) + padding * 2;
  const totalHeight = titleHeight + contentHeight;

  // Card shadow outline + body
  setRgb(pdf, 'draw', THEME.border);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, y, width, totalHeight, 1.5, 1.5, 'S');

  // Title bar
  setRgb(pdf, 'fill', THEME.navy);
  pdf.roundedRect(x, y, width, titleHeight, 1.5, 1.5, 'F');
  pdf.rect(x, y + titleHeight - 2, width, 2, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setRgb(pdf, 'text', THEME.white);
  pdf.text(title, x + padding, y + 5.5);

  let leftY = y + titleHeight + padding + 2;
  let rightY = leftY;

  for (const [label, value] of left) {
    leftY += drawFieldPair(pdf, label, value, leftX, leftY, colWidth) + 1.5;
  }
  for (const [label, value] of right) {
    rightY += drawFieldPair(pdf, label, value, rightX, rightY, colWidth) + 1.5;
  }

  return y + totalHeight + 6;
}

function drawCompanyBanner(
  pdf: jsPDF,
  companyName: string,
  addressLines: string[],
  contactBits: string[],
  x: number,
  y: number,
  width: number
): number {
  const padding = 4;
  pdf.setFontSize(8);
  const nameLines = pdf.splitTextToSize(companyName, width - padding * 2);
  const bodyLines = [...addressLines, ...contactBits];
  const wrappedBody = bodyLines.flatMap((line) =>
    pdf.splitTextToSize(line, width - padding * 2)
  );
  const height =
    padding * 2 + nameLines.length * 4.5 + (wrappedBody.length > 0 ? 2 : 0) + wrappedBody.length * 3.8;

  setRgb(pdf, 'fill', THEME.navyLight);
  setRgb(pdf, 'draw', THEME.border);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, width, height, 1.2, 1.2, 'FD');

  // Left accent bar
  setRgb(pdf, 'fill', THEME.navy);
  pdf.rect(x, y, 1.8, height, 'F');

  let cy = y + padding + 3;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setRgb(pdf, 'text', THEME.navyDark);
  pdf.text(nameLines, x + padding + 2, cy);
  cy += nameLines.length * 4.5 + 1;

  if (wrappedBody.length > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setRgb(pdf, 'text', THEME.slate);
    pdf.text(wrappedBody, x + padding + 2, cy);
  }

  return y + height + 6;
}

function drawTable(
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  colWidths: number[],
  pageHeight: number,
  onNewPage: () => number
): number {
  const headerHeight = 8;
  const lineWidth = 0.25;
  const cellPadding = 2;
  const lineHeight = 3.5;
  const minRowHeight = 7;
  const TABLE_FONT = 7;
  const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const bottomReserve = 18;

  const wrapRow = (row: string[]) =>
    row.map((cell, i) =>
      pdf.splitTextToSize(String(cell), Math.max(4, colWidths[i] - cellPadding * 2))
    );

  const drawHeader = (atY: number) => {
    setRgb(pdf, 'fill', THEME.navy);
    pdf.rect(x, atY, tableWidth, headerHeight, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(TABLE_FONT);
    setRgb(pdf, 'text', THEME.white);
    let cx = x;
    headers.forEach((header, index) => {
      pdf.text(header, cx + cellPadding, atY + 5.5);
      if (index < headers.length - 1) {
        setRgb(pdf, 'draw', [70, 100, 200]);
        pdf.setLineWidth(lineWidth);
        pdf.line(cx + colWidths[index], atY, cx + colWidths[index], atY + headerHeight);
      }
      cx += colWidths[index];
    });
  };

  pdf.setFontSize(TABLE_FONT);
  let currentY = y;
  drawHeader(currentY);
  currentY += headerHeight;

  rows.forEach((row, rowIndex) => {
    const cellLines = wrapRow(row);
    const rowHeight = Math.max(
      minRowHeight,
      Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + cellPadding
    );

    if (currentY + rowHeight > pageHeight - bottomReserve) {
      pdf.addPage();
      currentY = onNewPage();
      drawHeader(currentY);
      currentY += headerHeight;
    }

    if (rowIndex % 2 === 1) {
      setRgb(pdf, 'fill', THEME.rowAlt);
      pdf.rect(x, currentY, tableWidth, rowHeight, 'F');
    }

    setRgb(pdf, 'draw', THEME.border);
    pdf.setLineWidth(lineWidth);
    pdf.rect(x, currentY, tableWidth, rowHeight, 'S');

    pdf.setFont('helvetica', 'normal');
    setRgb(pdf, 'text', THEME.black);
    cellLines.forEach((lines, cellIndex) => {
      const cellX = x + colWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0) + cellPadding;
      lines.forEach((line, lineIdx) => {
        pdf.text(line, cellX, currentY + cellPadding + 2.5 + lineIdx * lineHeight);
      });
      if (cellIndex < colWidths.length - 1) {
        const divX = x + colWidths.slice(0, cellIndex + 1).reduce((a, b) => a + b, 0);
        pdf.line(divX, currentY, divX, currentY + rowHeight);
      }
    });

    currentY += rowHeight;
  });

  return currentY + 5;
}

function drawPageChrome(pdf: jsPDF, pageWidth: number, pageHeight: number, pageLabel?: string) {
  // Top navy bar
  setRgb(pdf, 'fill', THEME.navy);
  pdf.rect(0, 0, pageWidth, 26, 'F');
  setRgb(pdf, 'fill', THEME.navyDark);
  pdf.rect(0, 26, pageWidth, 1.2, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  setRgb(pdf, 'text', THEME.white);
  pdf.text('ACTINIUM-SM', pageWidth / 2, 11, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SHIP MANAGER SYSTEM', pageWidth / 2, 17.5, { align: 'center' });

  if (pageLabel) {
    pdf.setFontSize(7);
    pdf.text(pageLabel, pageWidth - 10, 17.5, { align: 'right' });
  }

  // Footer accent
  setRgb(pdf, 'fill', THEME.navy);
  pdf.rect(0, pageHeight - 14, pageWidth, 14, 'F');
  pdf.setFontSize(7);
  setRgb(pdf, 'text', THEME.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Generated by Actinium-sm Ship Manager System', pageWidth / 2, pageHeight - 8, {
    align: 'center',
  });
  pdf.setFont('helvetica', 'bold');
  pdf.text(`© ${new Date().getFullYear()} Actinium-sm. All rights reserved.`, pageWidth / 2, pageHeight - 3.5, {
    align: 'center',
  });
}

/**
 * GET /api/requisitions/[id]/pdf - Generate PDF of requisition
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: true,
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
            imoNumber: true,
            company: {
              select: {
                name: true,
                address: true,
                contactPerson: true,
                contactEmail: true,
                contactPhone: true,
                code: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const isAdmin = isAdminEquivalentAccessLevel(userAccessLevel);

    if (!isAdmin) {
      const assignedVessels = (currentUser as any).assignedVessels || [];
      const assignedVesselIds = assignedVessels
        .map((av: any) => av.vessel?.id)
        .filter((vid: any): vid is string => Boolean(vid));

      if (assignedVesselIds.length > 0 && !assignedVesselIds.includes(requisition.vesselId)) {
        return NextResponse.json(
          { error: 'Access denied. You do not have access to this vessel.' },
          { status: 403 }
        );
      }
    }

    const company = requisition.vessel.company;
    const companyName = company?.name?.trim() || 'Company details not available';
    const addressLines = formatAddress(company?.address);
    const contactBits: string[] = [];
    if (company?.contactPhone?.trim()) contactBits.push(`Tel: ${company.contactPhone.trim()}`);
    if (company?.contactEmail?.trim()) contactBits.push(`Email: ${company.contactEmail.trim()}`);
    if (company?.contactPerson?.trim()) contactBits.push(`Contact: ${company.contactPerson.trim()}`);
    if (company?.code?.trim()) contactBits.push(`Code: ${company.code.trim()}`);

    const createdByName = requisition.createdBy
      ? `${requisition.createdBy.firstName} ${requisition.createdBy.lastName}`.trim()
      : 'N/A';

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const leftMargin = 12;
    const usableWidth = pageWidth - leftMargin * 2;
    const pageLabel = requisition.requisitionNumber;

    const startContentY = () => {
      drawPageChrome(pdf, pageWidth, pageHeight, pageLabel);
      return 34;
    };

    let yPosition = startContentY();

    // Document title strip
    setRgb(pdf, 'fill', THEME.navyLight);
    pdf.roundedRect(leftMargin, yPosition, usableWidth, 12, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    setRgb(pdf, 'text', THEME.navyDark);
    pdf.text('REQUISITION', pageWidth / 2, yPosition + 8, { align: 'center' });
    yPosition += 16;

    // Vessel company name + address
    yPosition = drawCompanyBanner(
      pdf,
      companyName,
      addressLines,
      contactBits,
      leftMargin,
      yPosition,
      usableWidth
    );

    // Two-column requisition details
    const leftDetails: Array<[string, string]> = [
      ['Req. No.:', requisition.requisitionNumber],
      ['Heading:', requisition.heading || 'N/A'],
      ['Vessel:', requisition.vessel.name],
      ['IMO:', requisition.vessel.imoNumber || 'N/A'],
    ];
    const rightDetails: Array<[string, string]> = [
      ['Date:', new Date(requisition.dateOfCreation).toLocaleDateString()],
      ['Type:', requisition.requisitionType || 'N/A'],
      ['Status:', String(requisition.status || 'N/A').replace(/_/g, ' ')],
      ['Created By:', createdByName],
    ];

    yPosition = drawTwoColumnDetails(
      pdf,
      'REQUISITION DETAILS',
      leftDetails,
      rightDetails,
      leftMargin,
      yPosition,
      usableWidth
    );

    // Items
    if (requisition.items && requisition.items.length > 0) {
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = startContentY();
      }

      // Section heading with accent
      setRgb(pdf, 'fill', THEME.navy);
      pdf.rect(leftMargin, yPosition, 3, 6, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      setRgb(pdf, 'text', THEME.navyDark);
      pdf.text('ITEMS', leftMargin + 5, yPosition + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      setRgb(pdf, 'text', THEME.muted);
      pdf.text(`${requisition.items.length} line item(s)`, leftMargin + 24, yPosition + 5);
      yPosition += 10;

      const itemHeaders = ['S.No.', 'Part / Item Name', 'Code', 'ROB', 'Qty', 'Unit', 'Urgency'];
      const itemColWidths = [12, 62, 28, 16, 16, 16, 20];

      const itemRows = requisition.items.map((item, index) => {
        const typedItem = item as unknown as RequisitionItem;
        return [
          (index + 1).toString(),
          typedItem.partName || typedItem.itemName || '-',
          typedItem.partNumber || typedItem.itemNumber || '-',
          String(typedItem.currentRob ? Number(typedItem.currentRob) : 0),
          String(typedItem.quantity || 0),
          typedItem.unit || '-',
          typedItem.urgency || 'NORMAL',
        ];
      });

      yPosition = drawTable(
        pdf,
        itemHeaders,
        itemRows,
        leftMargin,
        yPosition,
        itemColWidths,
        pageHeight,
        startContentY
      );
    }

    // Ensure chrome on first page (already drawn); remaining pages get chrome via startContentY
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      // Re-draw footer only if a continuation page somehow missed chrome —
      // startContentY always draws full chrome on new pages.
      if (p > 1) {
        // Header/footer already applied via startContentY when page was added
      }
    }

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Requisition_${requisition.requisitionNumber}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error generating requisition PDF:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate requisition PDF', details: message },
      { status: 500 }
    );
  }
}
