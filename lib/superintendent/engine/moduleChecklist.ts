import type { DdProjectModuleId } from "./projectModules";

/** Checklist categories surfaced in each project workspace module page. */
export const MODULE_CHECKLIST_CATEGORIES: Partial<Record<DdProjectModuleId, string[]>> = {
  permits: ["Permits", "Safety"],
  procurement: ["Procurement", "Commercial"],
  inspections: ["Inspections", "Survey", "Technical"],
  sea_trial: ["Sea Trial", "Close-out"],
};

export type ModuleChecklistKey = keyof typeof MODULE_CHECKLIST_CATEGORIES;

export function categoriesForModule(module: ModuleChecklistKey): string[] {
  return MODULE_CHECKLIST_CATEGORIES[module] ?? [];
}

export function isModuleChecklistKey(value: string): value is ModuleChecklistKey {
  return value in MODULE_CHECKLIST_CATEGORIES;
}
