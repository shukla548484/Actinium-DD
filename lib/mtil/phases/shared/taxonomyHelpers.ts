import type { MtilComponentDef } from "../../types";

export const WEAR: MtilComponentDef["actions"] = [
  "inspect",
  "survey",
  "measure",
  "renew",
  "repair",
  "report",
];

export const OVERHAUL: MtilComponentDef["actions"] = [
  "inspect",
  "overhaul",
  "repair",
  "test",
  "replace",
  "adjust",
  "clean",
  "report",
];

export const INSTRUMENT: MtilComponentDef["actions"] = [
  "inspect",
  "test",
  "calibrate",
  "adjust",
  "report",
];

export const FUEL: MtilComponentDef["actions"] = [
  "inspect",
  "overhaul",
  "clean",
  "test",
  "replace",
  "adjust",
  "report",
];

export const SERVICE: MtilComponentDef["actions"] = ["inspect", "overhaul", "clean", "test", "report"];

export function comp(
  code: string,
  name: string,
  actions: MtilComponentDef["actions"],
  opts: Partial<MtilComponentDef> = {},
): MtilComponentDef {
  return { code, name, actions, estimatedManhoursBase: 8, ...opts };
}
