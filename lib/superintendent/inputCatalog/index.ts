import type { DryDockProjectType } from "@prisma/client";
import { COMMON_VESSEL_SECTIONS } from "./common";
import { SPECIAL_SURVEY_VESSEL_SECTIONS } from "./specialSurvey";
import { INTERMEDIATE_SURVEY_VESSEL_SECTIONS } from "./intermediateSurvey";
import { DAMAGE_REPAIR_VESSEL_SECTIONS } from "./damageRepair";
import { OCCASIONAL_REPAIR_VESSEL_SECTIONS } from "./occasionalRepair";
import { UNDERWATER_SURVEY_VESSEL_SECTIONS } from "./underwaterSurvey";
import { NEW_INSTALLATION_VESSEL_SECTIONS } from "./newInstallation";
import { EMERGENCY_DOCKING_VESSEL_SECTIONS } from "./emergencyDocking";
import { LAYUP_REACTIVATION_VESSEL_SECTIONS } from "./layupReactivation";
import { CONVERSION_MODIFICATION_VESSEL_SECTIONS } from "./conversionModification";
import { WARRANTY_REPAIR_VESSEL_SECTIONS } from "./warrantyRepair";
import { SUPERINTENDENT_SECTIONS } from "./superintendentSections";
import { SHIPYARD_SECTIONS } from "./shipyardSections";
import { PROCUREMENT_SECTIONS } from "./procurementSections";
import { CLOSEOUT_INPUT_SECTIONS } from "./closeoutSections";
import type { InputPageKey, InputSectionCatalogEntry, InputSectionDef } from "./types";

export { INPUT_READINESS_PAGE_KEYS, INPUT_PAGE_LABELS, inputPageHref } from "./constants";

const ALL_SECTIONS: InputSectionDef[] = [
  ...COMMON_VESSEL_SECTIONS,
  ...SPECIAL_SURVEY_VESSEL_SECTIONS,
  ...INTERMEDIATE_SURVEY_VESSEL_SECTIONS,
  ...DAMAGE_REPAIR_VESSEL_SECTIONS,
  ...OCCASIONAL_REPAIR_VESSEL_SECTIONS,
  ...UNDERWATER_SURVEY_VESSEL_SECTIONS,
  ...NEW_INSTALLATION_VESSEL_SECTIONS,
  ...EMERGENCY_DOCKING_VESSEL_SECTIONS,
  ...LAYUP_REACTIVATION_VESSEL_SECTIONS,
  ...CONVERSION_MODIFICATION_VESSEL_SECTIONS,
  ...WARRANTY_REPAIR_VESSEL_SECTIONS,
  ...SUPERINTENDENT_SECTIONS,
  ...SHIPYARD_SECTIONS,
  ...PROCUREMENT_SECTIONS,
  ...CLOSEOUT_INPUT_SECTIONS,
];

const byKey = new Map(ALL_SECTIONS.map((s) => [s.key, s]));

export function getInputSectionDef(sectionKey: string): InputSectionDef | undefined {
  return byKey.get(sectionKey);
}

export function getSectionsForProjectType(
  projectType: DryDockProjectType,
  pageKey?: InputPageKey,
): InputSectionCatalogEntry[] {
  return ALL_SECTIONS.filter(
    (s) =>
      s.projectTypes.includes(projectType) && (pageKey == null || s.pageKey === pageKey),
  );
}

export function getMandatorySectionsForProjectType(
  projectType: DryDockProjectType,
  pageKey?: InputPageKey,
): InputSectionDef[] {
  return getSectionsForProjectType(projectType, pageKey).filter((s) => s.mandatory);
}

export { ALL_SECTIONS as INPUT_SECTION_CATALOG };
