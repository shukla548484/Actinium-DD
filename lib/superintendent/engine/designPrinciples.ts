/**
 * Actinium-DD — mandatory design gate for all new features.
 * @see lib/superintendent/engine/projectModules.ts
 * @see lib/superintendent/engine/projectTemplates.ts
 */

export const DRY_DOCK_DESIGN_RULES = {
  projectFirst:
    "Every activity in the Dry Dock module belongs to a DryDockProject. Nothing exists independently of a project.",
  templateEngine:
    "Project Type selects a template that provisions modules, jobs, checklists, budget, milestones, surveys, approvals, documents, and RFQ structure. Users never start from an empty project.",
  question1: "Which Project Type requires this feature?",
  question2: "Which Module owns this feature?",
  noStandaloneCrud:
    "No new page unless linked to a Project Type, a Functional Module, and the Project Workspace.",
} as const;

/** Reject features that cannot name a project type and owning module. */
export function assertDryDockFeatureOwnership(input: {
  projectTypes: string[];
  moduleId: string;
  featureName: string;
}): void {
  if (input.projectTypes.length === 0) {
    throw new Error(
      `[Dry Dock] "${input.featureName}" must specify at least one Project Type (${DRY_DOCK_DESIGN_RULES.question1})`,
    );
  }
  if (!input.moduleId.trim()) {
    throw new Error(
      `[Dry Dock] "${input.featureName}" must specify an owning Module (${DRY_DOCK_DESIGN_RULES.question2})`,
    );
  }
}
