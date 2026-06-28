import type { DryDockProjectType } from "@prisma/client";

/** DD01–DD10 catalogue codes shown in UI and reports. */
export const DRY_DOCK_TYPE_CODES = {
  special_survey: "DD01",
  intermediate_survey: "DD02",
  damage_repair: "DD03",
  occasional_repair: "DD04",
  underwater_survey: "DD05",
  new_installation: "DD06",
  emergency_docking: "DD07",
  layup_reactivation: "DD08",
  conversion_modification: "DD09",
  warranty_repair: "DD10",
} as const satisfies Record<DryDockProjectType, string>;

export type DryDockTypeCode = (typeof DRY_DOCK_TYPE_CODES)[DryDockProjectType];

export type DryDockProjectTypeMeta = {
  type: DryDockProjectType;
  code: DryDockTypeCode;
  label: string;
  description: string;
  recommended: boolean;
};

export const DRY_DOCK_PROJECT_TYPES: DryDockProjectTypeMeta[] = [
  {
    type: "special_survey",
    code: "DD01",
    label: "Special Survey",
    description: "Class special survey with full hull, machinery, and statutory scope.",
    recommended: true,
  },
  {
    type: "intermediate_survey",
    code: "DD02",
    label: "Intermediate Survey",
    description: "Intermediate class survey between special surveys.",
    recommended: true,
  },
  {
    type: "damage_repair",
    code: "DD03",
    label: "Damage Repair",
    description: "Collision, grounding, or structural damage repairs.",
    recommended: true,
  },
  {
    type: "occasional_repair",
    code: "DD04",
    label: "Occasional Repair",
    description: "Ad-hoc repairs outside a full survey cycle.",
    recommended: true,
  },
  {
    type: "underwater_survey",
    code: "DD05",
    label: "Underwater Survey (UWILD)",
    description: "In-water inspection without full docking.",
    recommended: true,
  },
  {
    type: "new_installation",
    code: "DD06",
    label: "New Installation / Retrofit",
    description: "Scrubber, BWTS, crane, or major equipment retrofit.",
    recommended: true,
  },
  {
    type: "emergency_docking",
    code: "DD07",
    label: "Emergency Docking",
    description: "Urgent docking — grounding, collision, propulsion failure.",
    recommended: true,
  },
  {
    type: "layup_reactivation",
    code: "DD08",
    label: "Lay-up / Reactivation",
    description: "Vessel lay-up preparation or return to service.",
    recommended: true,
  },
  {
    type: "conversion_modification",
    code: "DD09",
    label: "Conversion / Modification",
    description: "Ballast conversion, cargo change, or major modification.",
    recommended: true,
  },
  {
    type: "warranty_repair",
    code: "DD10",
    label: "Warranty Repair",
    description: "Newbuild or recent conversion warranty rectification.",
    recommended: true,
  },
];

const TYPE_MAP = new Map(DRY_DOCK_PROJECT_TYPES.map((t) => [t.type, t]));

export function getProjectTypeMeta(type: DryDockProjectType): DryDockProjectTypeMeta {
  return TYPE_MAP.get(type) ?? DRY_DOCK_PROJECT_TYPES[0];
}

export function formatProjectTypeLabel(type: DryDockProjectType): string {
  const meta = getProjectTypeMeta(type);
  return `${meta.code} · ${meta.label}`;
}

export const DRY_DOCK_PROJECT_TYPE_ITEMS = DRY_DOCK_PROJECT_TYPES.map((t) => ({
  value: t.type,
  label: `${t.code} — ${t.label}`,
}));
