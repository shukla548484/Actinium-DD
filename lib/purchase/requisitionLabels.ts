/** Purchase requisition labels — aligned with PMS `lib/types/requisition`. */

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

/** Static sub-categories until PMS budget/sub-category APIs are ported. */
export const PURCHASE_SUB_CATEGORIES: Record<string, Array<{ code: string; name: string; budgetLabel: string }>> = {
  STR: [
    { code: "STR-CONS", name: "Consumables", budgetLabel: "3000 Stores & Consumables → 3200 General Stores" },
    { code: "STR-TOOLS", name: "Tools & Hardware", budgetLabel: "3000 Stores & Consumables → 3210 Tools" },
    { code: "STR-SAFETY", name: "Safety Stores", budgetLabel: "3000 Stores & Consumables → 3220 Safety" },
    { code: "STR-CHE", name: "Chemicals", budgetLabel: "3000 Stores → 3300 Chemicals" },
  ],
  SPR: [
    { code: "SPR-ME", name: "Main Engine", budgetLabel: "4000 Spares → 4100 Main Engine" },
    { code: "SPR-AE", name: "Auxiliary Engine", budgetLabel: "4000 Spares → 4200 Auxiliary" },
    { code: "SPR-DECK", name: "Deck Machinery", budgetLabel: "4000 Spares → 4300 Deck" },
  ],
  PRO: [
    { code: "PRO-FOOD", name: "Provisions / Food", budgetLabel: "5000 Provisions → 5100 Food" },
    { code: "PRO-BOND", name: "Bonded Stores", budgetLabel: "5000 Provisions → 5200 Bond" },
  ],
  CHE: [
    { code: "CHE-DECK", name: "Deck Chemicals", budgetLabel: "3000 Stores → 3300 Chemicals" },
    { code: "CHE-ER", name: "Engine Room Chemicals", budgetLabel: "3000 Stores → 3310 ER Chemicals" },
  ],
  PNT: [
    { code: "PNT-HULL", name: "Hull Coatings", budgetLabel: "3000 Stores → 3400 Paint" },
    { code: "PNT-TOP", name: "Topside / Accommodation", budgetLabel: "3000 Stores → 3410 Paint Topside" },
  ],
  GLY: [{ code: "GLY-GEN", name: "Galley Supplies", budgetLabel: "5000 Provisions → 5300 Galley" }],
  LUB: [{ code: "LUB-GEN", name: "Lubricants", budgetLabel: "6000 Lubricants → 6100 Lube Oil" }],
  BNK: [{ code: "BNK-FUEL", name: "Bunker Fuel", budgetLabel: "7000 Bunkers → 7100 Fuel" }],
};

export function budgetLabelForType(type: string, subCode?: string | null): string {
  const list = PURCHASE_SUB_CATEGORIES[type];
  if (!list?.length) return "";
  if (subCode) {
    const hit = list.find((s) => s.code === subCode);
    if (hit) return hit.budgetLabel;
  }
  return list[0]!.budgetLabel;
}
