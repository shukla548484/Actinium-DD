import type { MtilBudgetMapping, MtilRfqMapping, MtilSparesLine } from "./types";
import { buildBudgetCode, buildRfqId } from "./standards";

export function defaultRfqMapping(input: {
  systemName: string;
  componentName: string;
  workshop: string;
  jobSeq: number;
}): MtilRfqMapping {
  return {
    rfqCategory: "Machinery",
    lineDescription: `${input.systemName} — ${input.componentName}`,
    unit: "job",
    costCode: buildRfqId("ENG", "ME", input.jobSeq),
  };
}

export function defaultBudgetMapping(input: {
  workshop: string;
  systemCode: string;
  jobSeq: number;
}): MtilBudgetMapping {
  return {
    budgetCategory: "Machinery",
    costCode: buildBudgetCode("ENG", input.jobSeq),
    workshop: input.workshop,
  };
}

export function defaultSparesForOverhaul(componentName: string): MtilSparesLine[] {
  return [
    { code: "SP-GSKT", description: `${componentName} gasket set`, unit: "set", typicalQty: 1 },
    { code: "SP-SEAL", description: `${componentName} seal kit`, unit: "set", typicalQty: 1 },
    { code: "SP-FILT", description: "Associated filter elements", unit: "pcs", typicalQty: 2 },
  ];
}

/** Manhours multiplier by job action. */
export const ACTION_MANHOUR_FACTOR: Record<string, number> = {
  inspect: 1,
  survey: 1.2,
  overhaul: 4,
  renew: 5,
  repair: 3,
  test: 0.8,
  calibrate: 1,
  clean: 0.6,
  adjust: 0.5,
  replace: 2.5,
  measure: 0.4,
  report: 0.3,
};

export const ACTION_PRIORITY: Record<string, import("@prisma/client").DdJobPriority> = {
  inspect: "medium",
  survey: "high",
  overhaul: "high",
  renew: "critical",
  repair: "high",
  test: "medium",
  calibrate: "medium",
  clean: "low",
  adjust: "low",
  replace: "high",
  measure: "medium",
  report: "low",
};
