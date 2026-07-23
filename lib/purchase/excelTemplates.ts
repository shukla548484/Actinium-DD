import * as XLSX from "xlsx";
import {
  BUDGET_CODES_CATALOG,
  formatBudgetCodeLabel,
} from "@/lib/purchase/budgetCodes";
import { PURCHASE_SUB_CATEGORIES } from "@/lib/purchase/requisitionLabels";

export function buildRequisitionQuoteTemplateBuffer(input: {
  vesselName: string;
  vesselCode: string;
  requisitionType: string;
  heading?: string | null;
  description?: string | null;
  portOfSupply?: string | null;
}): Buffer {
  const headerRows = [
    ["Quote Request Template"],
    ["Vessel", `${input.vesselName} (${input.vesselCode})`],
    ["Requisition Type", input.requisitionType],
    ["Heading", input.heading ?? ""],
    ["Description", input.description ?? ""],
    ["Port of Supply", input.portOfSupply ?? ""],
    [],
    ["#", "Item Name", "IMPA / Part No.", "Qty", "Unit", "Remarks"],
    [1, "", "", 1, "pcs", ""],
    [2, "", "", 1, "pcs", ""],
    [3, "", "", 1, "pcs", ""],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 18 },
    { wch: 8 },
    { wch: 8 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Quote Request");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildSubCategoryBudgetTemplateBuffer(): Buffer {
  const mappingRows: Array<Array<string | number>> = [
    ["Code", "Name", "Requisition Type", "L2 Budget Code", "Budget Label (from master)"],
  ];
  for (const [type, list] of Object.entries(PURCHASE_SUB_CATEGORIES)) {
    for (const row of list) {
      mappingRows.push([
        row.code,
        row.name,
        type,
        row.budgetCode,
        formatBudgetCodeLabel(row.budgetCode),
      ]);
    }
  }

  const masterRows: Array<Array<string | number>> = [
    [
      "Budget Scope",
      "Level",
      "Code",
      "Name",
      "Parent Code",
      "Parent Name",
      "Fund Type",
      "Display Order",
      "Active",
    ],
  ];
  for (const row of BUDGET_CODES_CATALOG) {
    masterRows.push([
      row.scope,
      row.level,
      row.code,
      row.name,
      row.parentCode ?? "",
      row.parentName ?? "",
      row.fundType ?? "",
      row.displayOrder,
      row.active ? "Y" : "N",
    ]);
  }

  const wb = XLSX.utils.book_new();
  const mapSheet = XLSX.utils.aoa_to_sheet(mappingRows);
  mapSheet["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 16 },
    { wch: 14 },
    { wch: 56 },
  ];
  XLSX.utils.book_append_sheet(wb, mapSheet, "Sub-categories");

  const masterSheet = XLSX.utils.aoa_to_sheet(masterRows);
  masterSheet["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 32 },
    { wch: 12 },
    { wch: 28 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, masterSheet, "Budget master");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
