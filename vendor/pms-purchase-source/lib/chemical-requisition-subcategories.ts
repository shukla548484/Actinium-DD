/**
 * Chemical requisition (CHE) sub-categories and default Level 2 budget codes.
 * Used as API fallback before DB seed and kept in sync with prisma/sql/add-chemicals-requisition-type.sql.
 */
export type ChemicalSubCategoryRow = {
  code: string;
  name: string;
  defaultBudgetCategoryCode: string;
  displayOrder: number;
};

/** Level 2 codes under 3000 Stores & Consumables. */
export const CHEMICAL_BUDGET_CODES = {
  mixed: "3500",
  deck: "3510",
  engine: "3520",
  tankCleaning: "3530",
  cargoHold: "3540",
  bwts: "3550",
} as const;

export const CHEMICAL_REQUISITION_SUBCATEGORIES: ChemicalSubCategoryRow[] = [
  {
    code: "CHE-DCK",
    name: "Deck Chemical",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.deck,
    displayOrder: 10,
  },
  {
    code: "CHE-ENG",
    name: "Engine Chemicals",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.engine,
    displayOrder: 20,
  },
  {
    code: "CHE-TCL",
    name: "Tank Cleaning Chemicals",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.tankCleaning,
    displayOrder: 30,
  },
  {
    code: "CHE-CHC",
    name: "Cargo Hold Cleaning Chemicals",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.cargoHold,
    displayOrder: 40,
  },
  {
    code: "CHE-BWT",
    name: "BWTS Chemicals",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.bwts,
    displayOrder: 50,
  },
  {
    code: "CHE-COM",
    name: "Mixed Chemicals",
    defaultBudgetCategoryCode: CHEMICAL_BUDGET_CODES.mixed,
    displayOrder: 90,
  },
];

export const CHEMICAL_REQUISITION_TYPE_DEFAULT_BUDGET = CHEMICAL_BUDGET_CODES.mixed;

export const CHEMICAL_BUDGET_CATEGORY_NAMES: Record<string, string> = {
  [CHEMICAL_BUDGET_CODES.mixed]: "Cleaning Materials & Chemicals",
  [CHEMICAL_BUDGET_CODES.deck]: "Deck Cleaning Chemicals",
  [CHEMICAL_BUDGET_CODES.engine]: "Engine Room Chemicals",
  [CHEMICAL_BUDGET_CODES.tankCleaning]: "Tank Cleaning Chemicals",
  [CHEMICAL_BUDGET_CODES.cargoHold]: "Cargo Hold Cleaning Chemicals",
  [CHEMICAL_BUDGET_CODES.bwts]: "BWTS / Water Treatment Chemicals",
};

export function chemicalSubcategoriesForApi(): Array<{
  code: string;
  name: string;
  defaultBudgetCategoryCode: string;
  displayOrder: number;
}> {
  return CHEMICAL_REQUISITION_SUBCATEGORIES.map((row) => ({
    code: row.code,
    name: row.name,
    defaultBudgetCategoryCode: row.defaultBudgetCategoryCode,
    displayOrder: row.displayOrder,
  }));
}

export function chemicalSubcategoryByCode(code: string): ChemicalSubCategoryRow | undefined {
  return CHEMICAL_REQUISITION_SUBCATEGORIES.find((row) => row.code === code);
}
