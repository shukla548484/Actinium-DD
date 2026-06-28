import type { CompanyCategory } from "@prisma/client";

export const COMPANY_CATEGORY_OPTIONS: { value: CompanyCategory; label: string }[] = [
  { value: "shipyard", label: "Shipyard" },
  { value: "ship_management", label: "Ship management company" },
  { value: "ship_owner", label: "Ship owner" },
  { value: "other", label: "Other" },
];

export function companyCategoryLabel(category: CompanyCategory): string {
  return COMPANY_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
}

export function isShipownerCategory(category: CompanyCategory): boolean {
  return category === "ship_owner";
}
