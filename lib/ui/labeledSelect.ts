/** Base UI Select needs `items` to show labels instead of raw values. */

export type LabeledOption = { value: string; label: string };

export function mapSelectItems<T>(
  items: T[],
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
): LabeledOption[] {
  return items.map((item) => ({ value: getValue(item), label: getLabel(item) }));
}

export function formatEnumLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function enumSelectItems(values: readonly string[]): LabeledOption[] {
  return values.map((value) => ({ value, label: formatEnumLabel(value) }));
}

export const ENTITY_STATUS_ITEMS: LabeledOption[] = [
  { value: "active", label: "Active" },
  { value: "wait", label: "Waiting" },
  { value: "inactive", label: "Inactive" },
];

export const COMPANY_TYPE_ITEMS: LabeledOption[] = [
  { value: "MASTER", label: "Master company" },
  { value: "SUB", label: "Sub company" },
];

export const PAGE_ACCESS_TYPE_ITEMS: LabeledOption[] = [
  { value: "all", label: "All types" },
  { value: "system", label: "System" },
  { value: "office", label: "Office" },
  { value: "vessel", label: "Vessel" },
  { value: "shipyard", label: "Shipyard" },
  { value: "external", label: "External (vendors)" },
];
