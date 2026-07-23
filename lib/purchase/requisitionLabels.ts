/** Purchase requisition labels — aligned with PMS `lib/types/requisition`. */

import {
  formatBudgetCodeLabel,
  SUBCATEGORY_DEFAULT_BUDGET_CODE,
  autoBudgetCodeForRequisition,
} from "@/lib/purchase/budgetCodes";

export const PURCHASE_REQ_TYPE_LABELS: Record<string, string> = {
  STR: "Store Requisition",
  SPR: "Spares Requisition",
  GLY: "Galley Requisition",
  PNT: "Paint Requisition",
  REP: "Repair Requisition Request",
  SER: "Service Requisition Request",
  CTM: "CTM Request",
  PRO: "Provision Request",
  BNK: "Bunker Request",
  LUB: "Lube Oil Request",
  FCL: "Flag/Class Request",
  OTR: "Other Requisitions",
  CHE: "Chemicals Requisition",
};

export const PURCHASE_REQ_TYPES = Object.keys(PURCHASE_REQ_TYPE_LABELS);

export const PURCHASE_REQ_PURPOSE_LABELS: Record<string, string> = {
  ROUTINE_MAINTENANCE: "Routine Maintenance",
  DEFECT_CLOSER_REQUISITION: "Defect Closer Requisition",
  DRY_DOCK: "Dry Dock",
  SPECIAL_REQUIREMENT: "Special Requirement",
  OTHERS: "Others",
};

export const PURCHASE_REQ_URGENCY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
  CRITICAL: "Critical",
};

type SubCategoryDef = { code: string; name: string; budgetCode: string };

/**
 * Sub-categories with Level 2 budget codes from data/budget-codes.json
 * (master: data/all-budget-codes.xlsx).
 */
export const PURCHASE_SUB_CATEGORIES: Record<string, SubCategoryDef[]> = {
  STR: [
    { code: "STR-CONS", name: "Consumables / Deck Stores", budgetCode: "3200" },
    { code: "STR-ENG", name: "Engine Stores", budgetCode: "3100" },
    { code: "STR-ELEC", name: "Electrical Stores", budgetCode: "3300" },
    { code: "STR-TOOLS", name: "Tools & Workshop Stores", budgetCode: "3400" },
    { code: "STR-CHE", name: "Cleaning Chemicals", budgetCode: "3500" },
    { code: "STR-REF", name: "Refrigeration Stores", budgetCode: "3700" },
    { code: "STR-SAFETY", name: "Safety Stores", budgetCode: "3800" },
  ],
  SPR: [
    { code: "SPR-ME", name: "Main Engine Spares", budgetCode: "2100" },
    { code: "SPR-AE", name: "Auxiliary Engine Spares", budgetCode: "2200" },
    { code: "SPR-BOIL", name: "Boiler Spares", budgetCode: "2300" },
    { code: "SPR-PUMP", name: "Pump Spares", budgetCode: "2400" },
    { code: "SPR-COMP", name: "Compressor Spares", budgetCode: "2500" },
    { code: "SPR-ELEC", name: "Electrical Spares", budgetCode: "2600" },
    { code: "SPR-AUTO", name: "Automation Spares", budgetCode: "2700" },
    { code: "SPR-DECK", name: "Deck Machinery Spares", budgetCode: "2800" },
    { code: "SPR-CARGO", name: "Cargo System Spares", budgetCode: "2900" },
  ],
  PRO: [
    { code: "PRO-FOOD", name: "Provisions / Food", budgetCode: "1600" },
    { code: "PRO-BOND", name: "Bonded Stores", budgetCode: "1600" },
  ],
  CHE: [
    { code: "CHE-DECK", name: "Deck / Cleaning Chemicals", budgetCode: "3500" },
    { code: "CHE-ER", name: "Engine Room / Boiler Chemicals", budgetCode: "3600" },
  ],
  PNT: [
    { code: "PNT-HULL", name: "Hull Coatings", budgetCode: "10300" },
    { code: "PNT-TOP", name: "Topside / Workshop Coatings", budgetCode: "3400" },
  ],
  GLY: [{ code: "GLY-GEN", name: "Galley Supplies", budgetCode: "1600" }],
  LUB: [
    { code: "LUB-CYL", name: "Main Engine Cylinder Oil", budgetCode: "4100" },
    { code: "LUB-SYS", name: "Main Engine System Oil", budgetCode: "4200" },
    { code: "LUB-GENSET", name: "Generator Engine Oil", budgetCode: "4300" },
    { code: "LUB-HYD", name: "Hydraulic Oil", budgetCode: "4400" },
    { code: "LUB-GEAR", name: "Gear Oil", budgetCode: "4500" },
    { code: "LUB-COMP", name: "Compressor Oil", budgetCode: "4600" },
    { code: "LUB-GREASE", name: "Grease", budgetCode: "4700" },
  ],
  BNK: [
    { code: "BNK-HFO", name: "HFO", budgetCode: "12100" },
    { code: "BNK-VLSFO", name: "VLSFO", budgetCode: "12200" },
    { code: "BNK-MGO", name: "MGO", budgetCode: "12300" },
    { code: "BNK-LNG", name: "LNG", budgetCode: "12400" },
    { code: "BNK-ADD", name: "Fuel Additives", budgetCode: "12500" },
  ],
  REP: [
    { code: "REP-ME", name: "Main Engine Repair", budgetCode: "5100" },
    { code: "REP-AE", name: "Aux Engine Repair", budgetCode: "5200" },
    { code: "REP-BOIL", name: "Boiler Repair", budgetCode: "5300" },
    { code: "REP-PUMP", name: "Pump Repair", budgetCode: "5400" },
    { code: "REP-ELEC", name: "Electrical Repair", budgetCode: "5500" },
    { code: "REP-AUTO", name: "Automation Repair", budgetCode: "5600" },
    { code: "REP-DECK", name: "Deck Machinery Repair", budgetCode: "5700" },
    { code: "REP-CARGO", name: "Cargo Equipment Repair", budgetCode: "5800" },
    { code: "REP-HULL", name: "Hull Repair", budgetCode: "5900" },
  ],
  FCL: [
    { code: "FCL-CLASS", name: "Class Surveys", budgetCode: "6100" },
    { code: "FCL-FLAG", name: "Flag Surveys", budgetCode: "6200" },
    { code: "FCL-STAT", name: "Statutory Surveys", budgetCode: "6300" },
  ],
};

/** @deprecated Prefer budgetCodeForType + formatBudgetCodeLabel */
export function budgetLabelForType(type: string, subCode?: string | null): string {
  const code = budgetCodeForType(type, subCode);
  return code ? formatBudgetCodeLabel(code) : "";
}

export function budgetCodeForType(
  type: string,
  subCode?: string | null,
  purpose?: string | null,
): string {
  return (
    autoBudgetCodeForRequisition({
      requisitionType: type,
      subCategoryCode: subCode,
      requisitionPurpose: purpose,
    }) ?? ""
  );
}

export function budgetLabelForCode(code: string | null | undefined): string {
  return formatBudgetCodeLabel(code, { allowLegacy: true });
}

/** Ensure subcategory maps stay aligned with SUBCATEGORY_DEFAULT_BUDGET_CODE. */
for (const list of Object.values(PURCHASE_SUB_CATEGORIES)) {
  for (const row of list) {
    const mapped = SUBCATEGORY_DEFAULT_BUDGET_CODE[row.code];
    if (mapped && mapped !== row.budgetCode) {
      row.budgetCode = mapped;
    } else if (!mapped) {
      SUBCATEGORY_DEFAULT_BUDGET_CODE[row.code] = row.budgetCode;
    }
  }
}
