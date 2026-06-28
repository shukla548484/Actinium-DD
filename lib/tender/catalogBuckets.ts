/** Primary shipyard quote wizard steps (01 + 02). */
export const DOCKING_COST_BUCKET = "docking_cost";
export const GENERAL_SERVICE_COST_BUCKET = "general_service_cost";

export const WIZARD_PRIMARY_BUCKETS = [DOCKING_COST_BUCKET, GENERAL_SERVICE_COST_BUCKET] as const;

export type WizardStep = "docking" | "general" | "other" | "summary";

export const WIZARD_STEPS: { id: WizardStep; bucket?: string; label: string }[] = [
  { id: "docking", bucket: DOCKING_COST_BUCKET, label: "01 Docking Cost" },
  { id: "general", bucket: GENERAL_SERVICE_COST_BUCKET, label: "02 General Services" },
  { id: "other", label: "Other scope" },
  { id: "summary", label: "Review & submit" },
];

export function bucketsForWizardStep(step: WizardStep): string[] | null {
  if (step === "docking") return [DOCKING_COST_BUCKET];
  if (step === "general") return [GENERAL_SERVICE_COST_BUCKET];
  if (step === "other") return null; // all except primary
  return null;
}

export function lineMatchesWizardStep(lineBucket: string, step: WizardStep): boolean {
  if (step === "docking") return lineBucket === DOCKING_COST_BUCKET;
  if (step === "general") return lineBucket === GENERAL_SERVICE_COST_BUCKET;
  if (step === "other") return !WIZARD_PRIMARY_BUCKETS.includes(lineBucket as (typeof WIZARD_PRIMARY_BUCKETS)[number]);
  return true;
}
