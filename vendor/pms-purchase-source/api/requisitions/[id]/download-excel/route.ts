import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { RequisitionItem } from "@/lib/types/requisition";
import {
  createBrandedWorkbook,
  addBrandedHeader,
  addBrandedFooter,
  styleHeaderRow,
  styleDataRow,
  addBorders,
  setOptimalColumnWidths,
  BRAND_COLORS,
} from "@/lib/excel-branding";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/requisitions/[id]/download-excel - Download requisition as Excel
export async function GET(
  _: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    
    // Check if requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: true,
        vessel: {
          select: {
            name: true,
            code: true,
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
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Create branded workbook
    const workbook = createBrandedWorkbook();
    const worksheet = workbook.addWorksheet("Requisition");

    // Add branded header
    let currentRow = addBrandedHeader(
      worksheet,
      "REQUISITION DETAILS",
      `Requisition Number: ${requisition.requisitionNumber}`,
      1,
      7
    );

    // Requisition Details Section
    const detailsStartRow = currentRow;
    const detailRows = [
      { label: "Requisition Number", value: requisition.requisitionNumber },
      { label: "Heading", value: requisition.heading },
      { label: "Description", value: requisition.description || "N/A" },
      { label: "Requisition Type", value: requisition.requisitionType },
      { label: "Status", value: requisition.status },
      { label: "Generation Status", value: requisition.generationStatus },
      { label: "Vessel", value: requisition.vessel?.name || "" },
      { label: "Vessel Code", value: requisition.vessel?.code || "" },
      { label: "Port of Supply", value: requisition.portOfSupply || "N/A" },
      { label: "Port Agent Details", value: requisition.portAgentDetails || "N/A" },
      {
        label: "Created By",
        value: requisition.createdBy
          ? `${requisition.createdBy.firstName} ${requisition.createdBy.lastName}`
          : "",
      },
      {
        label: "Created At",
        value: requisition.dateOfCreation
          ? requisition.dateOfCreation.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "N/A",
      },
    ];

    detailRows.forEach((detail, index) => {
      const row = worksheet.getRow(currentRow + index);
      const labelCell = row.getCell(1);
      const valueCell = row.getCell(2);

      labelCell.value = detail.label + ":";
      labelCell.font = { bold: true, size: 10, name: "Arial" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: BRAND_COLORS.HEADER,
      };
      addBorders(labelCell);

      valueCell.value = detail.value;
      valueCell.font = { size: 10, name: "Arial" };
      addBorders(valueCell);

      row.height = 20;
    });

    currentRow += detailRows.length + 2; // Add spacing

    // Items Section
    if (requisition.items && requisition.items.length > 0) {
      // Items header
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const itemsHeaderCell = worksheet.getCell(`A${currentRow}`);
      itemsHeaderCell.value = "ITEMS";
      itemsHeaderCell.font = {
        bold: true,
        size: 14,
        color: BRAND_COLORS.TEXT_LIGHT,
        name: "Arial",
      };
      itemsHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
      itemsHeaderCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: BRAND_COLORS.SECONDARY,
      };
      addBorders(itemsHeaderCell, "medium");
      worksheet.getRow(currentRow).height = 25;
      currentRow++;

      // Items table header
      const headerRow = worksheet.getRow(currentRow);
      const headers = [
        "S.NO.",
        "PART/ITEM NAME",
        "CODE",
        "ROB",
        "QTY",
        "ADDITIONAL INFORMATION",
        "URGENCY",
      ];
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
      });
      styleHeaderRow(worksheet, headerRow, headers);
      currentRow++;

      // Items data rows
      requisition.items.forEach((item, index) => {
        const dataRow = worksheet.getRow(currentRow);
        const typedItem = item as unknown as RequisitionItem;
        dataRow.getCell(1).value = index + 1;
        dataRow.getCell(2).value = typedItem.partName || typedItem.itemName;
        dataRow.getCell(3).value = typedItem.partNumber || typedItem.itemNumber || ""; // CODE
        dataRow.getCell(4).value = typedItem.currentRob ? Number(typedItem.currentRob) : 0; // ROB
        dataRow.getCell(5).value = `${typedItem.quantity} ${typedItem.unit}`;
        
        // Build additional info string
        const additionalInfoParts = [];
        if (typedItem.drawingNumber) additionalInfoParts.push(`Drawing: ${typedItem.drawingNumber}`);
        if (typedItem.remarks) additionalInfoParts.push(typedItem.remarks);
        if (typedItem.description && typedItem.description !== typedItem.itemName) additionalInfoParts.push(typedItem.description);
        
        dataRow.getCell(6).value = additionalInfoParts.join(" | ");
        dataRow.getCell(7).value = typedItem.urgency || "NORMAL";
        styleDataRow(worksheet, dataRow, index % 2 === 1);
        currentRow++;
      });
    }

    // Set column widths
    setOptimalColumnWidths(worksheet, [12, 50, 15, 10, 15, 40, 12]);

    // Add branded footer
    addBrandedFooter(
      worksheet,
      {
        generatedBy: requisition.createdBy
          ? `${requisition.createdBy.firstName} ${requisition.createdBy.lastName}`
          : undefined,
        generatedAt: new Date(),
      },
      currentRow + 1,
      7
    );

    // Generate Excel file buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Return file for download
    const fileName = `Requisition_${requisition.requisitionNumber}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generating requisition Excel:", error);
    return NextResponse.json(
      { error: "Failed to generate requisition Excel file" },
      { status: 500 }
    );
  }
}

