/** MTIL Version 2.0 — production-grade normalized engineering database targets. */

export const MTIL_V2_ENGINE_VERSION = "2.0.0";
export const MTIL_V2_LIBRARY_VERSION = "MTIL-v2.0";

/** Actinium-SM Engineering Master Code Standard — canonical 4-letter entity IDs. */
export { MASTER_CODE_STANDARD_VERSION } from "@/lib/mtil/masterCodeStandard";

/** Permanent Actinium-SM engineering database capacity targets. */
export const MTIL_V2_DATABASE_TARGETS = {
  jobs: { min: 4000, max: 5000 },
  dynamicTemplates: { min: 250, max: 300 },
  inspectionPoints: { min: 25000, max: 30000 },
  measurementParameters: { min: 12000, max: 15000 },
  spareMaterialMappings: { min: 20000, max: 25000 },
  rfqBudgetMappings: { min: 10000, max: 12000 },
} as const;

/** Minimum attributes per production job row (commercial CMMS parity). */
export const MTIL_V2_JOB_ATTRIBUTE_COUNT = { min: 60, max: 80 } as const;

/** R0.x framework releases — frozen baseline; V2.0 upgrades domains in place. */
export const MTIL_R0_FRAMEWORK_COMPLETE = true;
