/** Common dry-dock job type / permit requirements captured on vessel job create. */
export const JOB_REQUIREMENT_OPTIONS = [
  { key: "hot_work", label: "Hot work" },
  { key: "staging", label: "Staging / scaffolding" },
  { key: "removal_fitting", label: "Removal & fitting" },
  { key: "lighting", label: "Lighting" },
  { key: "confined_space", label: "Confined space" },
  { key: "gas_free", label: "Gas-free" },
  { key: "crane_lifting", label: "Crane / lifting" },
  { key: "maker_attendance", label: "Maker attendance" },
  { key: "class_attendance", label: "Class attendance" },
] as const;

export type JobRequirementKey = (typeof JOB_REQUIREMENT_OPTIONS)[number]["key"];

export function isJobRequirementKey(value: string): value is JobRequirementKey {
  return JOB_REQUIREMENT_OPTIONS.some((option) => option.key === value);
}
