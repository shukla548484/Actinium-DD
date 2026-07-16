import * as XLSX from "xlsx";

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
  const rows = [
    ["Code", "Name", "Requisition Type", "Default Budget Label"],
    ["STR-CONS", "Consumables", "STR", "3000 Stores & Consumables → 3200 General Stores"],
    ["STR-TOOLS", "Tools & Hardware", "STR", "3000 Stores & Consumables → 3210 Tools"],
    ["STR-SAFETY", "Safety Stores", "STR", "3000 Stores & Consumables → 3220 Safety"],
    ["STR-CHE", "Chemicals", "STR", "3000 Stores → 3300 Chemicals"],
    ["SPR-ME", "Main Engine", "SPR", "4000 Spares → 4100 Main Engine"],
    ["SPR-AE", "Auxiliary Engine", "SPR", "4000 Spares → 4200 Auxiliary"],
    ["SPR-DECK", "Deck Machinery", "SPR", "4000 Spares → 4300 Deck"],
    ["PRO-FOOD", "Provisions / Food", "PRO", "5000 Provisions → 5100 Food"],
    ["PRO-BOND", "Bonded Stores", "PRO", "5000 Provisions → 5200 Bond"],
    ["CHE-DECK", "Deck Chemicals", "CHE", "3000 Stores → 3300 Chemicals"],
    ["CHE-ER", "Engine Room Chemicals", "CHE", "3000 Stores → 3310 ER Chemicals"],
    ["PNT-HULL", "Hull Coatings", "PNT", "3000 Stores → 3400 Paint"],
    ["GLY-GEN", "Galley Supplies", "GLY", "5000 Provisions → 5300 Galley"],
    ["LUB-GEN", "Lubricants", "LUB", "6000 Lubricants → 6100 Lube Oil"],
    ["BNK-FUEL", "Bunker Fuel", "BNK", "7000 Bunkers → 7100 Fuel"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, ws, "Sub-categories");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
