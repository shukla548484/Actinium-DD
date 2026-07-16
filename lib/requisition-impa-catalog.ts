import { RequisitionType } from "@/lib/types/requisition";

/** Requisition types that use IMPA item search + manual entry (store-style item rows). */
export const IMPA_CATALOG_REQUISITION_TYPES: RequisitionType[] = [
  RequisitionType.STR,
  RequisitionType.GLY,
  RequisitionType.OTR,
  RequisitionType.PRO,
];

export function usesImpaCatalogSearch(
  requisitionType: RequisitionType | string | null | undefined
): boolean {
  if (!requisitionType) return false;
  return IMPA_CATALOG_REQUISITION_TYPES.includes(requisitionType as RequisitionType);
}

/** Provision requisitions limit IMPA search to welfare/provision band (000101–101939). */
export function usesProvisionImpaSearchScope(
  requisitionType: RequisitionType | string | null | undefined
): boolean {
  return requisitionType === RequisitionType.PRO;
}

/** Store requisitions with a chemical sub-category (e.g. STR-CHE). */
export function isChemicalStoreSubCategory(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return (
    normalized.startsWith("STR-CHE") ||
    normalized.includes("CHEMICAL") ||
    normalized.endsWith("-CHE")
  );
}

/** Chemical requisitions use IMPA chapter 55 (cleaning materials & chemicals). */
export function usesChemicalImpaSearchScope(
  requisitionType: RequisitionType | string | null | undefined,
  subCategoryCodes: string[] = []
): boolean {
  if (requisitionType === RequisitionType.CHE) return true;
  if (requisitionType !== RequisitionType.STR) return false;
  return subCategoryCodes.some(isChemicalStoreSubCategory);
}

export function impaCatalogItemNamePlaceholder(
  requisitionType: RequisitionType | string | null | undefined,
  subCategoryCodes: string[] = []
): string {
  if (requisitionType === RequisitionType.PRO) {
    return "Search provision / welfare items...";
  }
  if (usesChemicalImpaSearchScope(requisitionType, subCategoryCodes)) {
    return "Search cleaning & chemical items...";
  }
  if (requisitionType === RequisitionType.GLY) {
    return "Search galley items or type manually...";
  }
  if (requisitionType === RequisitionType.OTR) {
    return "Search items or type manually...";
  }
  return "Type item name to search IMPA...";
}

export function impaCatalogCodePlaceholder(
  requisitionType: RequisitionType | string | null | undefined,
  subCategoryCodes: string[] = []
): string {
  if (usesProvisionImpaSearchScope(requisitionType)) {
    return "Search provision IMPA code...";
  }
  if (usesChemicalImpaSearchScope(requisitionType, subCategoryCodes)) {
    return "Search chemical IMPA code...";
  }
  return "Type IMPA code to search...";
}
