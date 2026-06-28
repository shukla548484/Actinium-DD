import { z } from "zod";

const optionalDate = z.union([z.string(), z.coerce.date()]).nullable().optional();
const requiredDate = z.union([z.string(), z.coerce.date()]);

export const dryDockProjectStatusSchema = z.enum([
  "draft",
  "planning",
  "budgeting",
  "rfq_issued",
  "quote_evaluation",
  "tendering",
  "approved",
  "mobilization",
  "awarded",
  "docking",
  "in_progress",
  "execution",
  "sea_trial",
  "final_inspection",
  "completed",
  "closed",
  "archived",
  "on_hold",
  "cancelled",
  "reopened",
]);

export const dryDockProjectTypeSchema = z.enum([
  "special_survey",
  "intermediate_survey",
  "damage_repair",
  "occasional_repair",
  "underwater_survey",
  "new_installation",
  "emergency_docking",
  "layup_reactivation",
  "conversion_modification",
  "warranty_repair",
]);

export const dryDockProjectPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const ddJobStatusSchema = z.enum([
  "planned",
  "in_progress",
  "pending_approval",
  "completed",
  "closed",
]);

export const ddJobPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const ddApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);

export const ddRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const ddSurveyStatusSchema = z.enum(["pending", "in_progress", "completed", "deferred"]);

export const ddSparesStatusSchema = z.enum([
  "required",
  "ordered",
  "delivered",
  "pending",
  "cancelled",
]);

export const ddPoStatusSchema = z.enum([
  "draft",
  "issued",
  "acknowledged",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const ddResourceTypeSchema = z.enum([
  "crane",
  "scaffolding",
  "worker_team",
  "equipment",
  "other",
]);

export const ddResourceStatusSchema = z.enum(["planned", "mobilized", "active", "demobilized"]);

export const vesselTechnicalProfileSchema = z.object({
  classNotation: z.string().nullable().optional(),
  mainEngine: z.string().nullable().optional(),
  auxiliaryEngine: z.string().nullable().optional(),
  boilerInfo: z.string().nullable().optional(),
  defectSummary: z.string().nullable().optional(),
  pmsSummary: z.string().nullable().optional(),
  sparesSummary: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const vesselSuperintendentPatchSchema = z
  .object({
    name: z.string().min(2).optional(),
    imoNumber: z.string().nullable().optional(),
    flag: z.string().nullable().optional(),
    vesselType: z.string().nullable().optional(),
    callSign: z.string().nullable().optional(),
    grossTonnage: z.number().nullable().optional(),
    yearBuilt: z.number().int().min(1900).max(2100).nullable().optional(),
    nextDryDockDue: optionalDate,
    lastDryDockDate: optionalDate,
    classSociety: z.string().nullable().optional(),
    readinessScore: z.number().int().min(0).max(100).nullable().optional(),
    technicalProfile: vesselTechnicalProfileSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const dryDockProjectCreateSchema = z.object({
  vesselId: z.string().min(1, "Vessel is required"),
  projectId: z.string().nullable().optional(),
  name: z.string().min(2, "Project name is required"),
  projectType: dryDockProjectTypeSchema,
  priority: dryDockProjectPrioritySchema.optional(),
  referenceCode: z.string().nullable().optional(),
  status: dryDockProjectStatusSchema.optional(),
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  actualStart: optionalDate,
  actualEnd: optionalDate,
  expectedSailing: optionalDate,
  selectedYard: z.string().nullable().optional(),
  shipyardCountry: z.string().nullable().optional(),
  dockType: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  budgetTotal: z.number().nullable().optional(),
  approvedBudget: z.number().nullable().optional(),
  contingencyBudget: z.number().nullable().optional(),
  offHireCost: z.number().nullable().optional(),
  dryDockDays: z.number().int().nullable().optional(),
  classSociety: z.string().nullable().optional(),
  surveyType: z.string().nullable().optional(),
  mainScope: z.string().nullable().optional(),
  dockingReason: z.string().nullable().optional(),
  portLocation: z.string().nullable().optional(),
  projectOwner: z.string().nullable().optional(),
  quotedTotal: z.number().nullable().optional(),
  actualTotal: z.number().nullable().optional(),
  progressPct: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const dryDockProjectUpdateSchema = dryDockProjectCreateSchema
  .partial()
  .omit({ vesselId: true, referenceCode: true })
  .extend({ vesselId: z.string().optional() })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddJobCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  jobCode: z.string().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().nullable().optional(),
  workshop: z.string().nullable().optional(),
  priority: ddJobPrioritySchema.optional(),
  status: ddJobStatusSchema.optional(),
  progressPct: z.number().min(0).max(100).nullable().optional(),
  budgetAmount: z.number().nullable().optional(),
  quotedAmount: z.number().nullable().optional(),
  actualAmount: z.number().nullable().optional(),
  responsibleParty: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const ddJobUpdateSchema = ddJobCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddBudgetLineCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().nullable().optional(),
  budgetAmount: z.number().optional(),
  quotedAmount: z.number().nullable().optional(),
  approvedAmount: z.number().nullable().optional(),
  actualAmount: z.number().nullable().optional(),
  responsibleParty: z.string().nullable().optional(),
  varianceReason: z.string().nullable().optional(),
  approvalStatus: ddApprovalStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
});

export const ddBudgetLineUpdateSchema = ddBudgetLineCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddChecklistItemCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  title: z.string().min(1, "Title is required"),
  category: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  dueDate: optionalDate,
  completedAt: optionalDate,
  assignedTo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const ddChecklistItemUpdateSchema = ddChecklistItemCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddMilestoneCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  title: z.string().min(1, "Title is required"),
  plannedDate: optionalDate,
  baselineDate: optionalDate,
  actualDate: optionalDate,
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
  dependsOnMilestoneId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const ddMilestoneUpdateSchema = ddMilestoneCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddRiskItemCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  likelihood: ddRiskLevelSchema.optional(),
  impact: ddRiskLevelSchema.optional(),
  mitigation: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.string().optional(),
});

export const ddRiskItemUpdateSchema = ddRiskItemCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddVariationOrderCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  voNumber: z.string().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  amount: z.number().optional(),
  approvalStatus: ddApprovalStatusSchema.optional(),
  requestedBy: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
});

export const ddVariationOrderUpdateSchema = ddVariationOrderCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddDailyReportCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  reportDate: requiredDate,
  completedWork: z.string().nullable().optional(),
  plannedWork: z.string().nullable().optional(),
  manpowerCount: z.number().int().nullable().optional(),
  safetyNotes: z.string().nullable().optional(),
  delayNotes: z.string().nullable().optional(),
  progressPct: z.number().min(0).max(100).nullable().optional(),
});

export const ddDailyReportUpdateSchema = ddDailyReportCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddDelayItemCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  title: z.string().min(1, "Title is required"),
  reason: z.string().nullable().optional(),
  impactDays: z.number().nullable().optional(),
  responsibleParty: z.string().nullable().optional(),
  status: z.string().optional(),
});

export const ddDelayItemUpdateSchema = ddDelayItemCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddSurveyItemCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  surveyType: z.string().min(1, "Survey type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  dueDate: optionalDate,
  status: ddSurveyStatusSchema.optional(),
  classReference: z.string().nullable().optional(),
});

export const ddSurveyItemUpdateSchema = ddSurveyItemCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddSparesItemCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().nullable().optional(),
  quantity: z.number().optional(),
  supplyType: z.string().optional(),
  status: ddSparesStatusSchema.optional(),
  requiredDate: optionalDate,
  deliveredDate: optionalDate,
  notes: z.string().nullable().optional(),
});

export const ddSparesItemUpdateSchema = ddSparesItemCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddPurchaseOrderCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  poNumber: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: ddPoStatusSchema.optional(),
  orderedDate: optionalDate,
  expectedDelivery: optionalDate,
  deliveredDate: optionalDate,
  notes: z.string().nullable().optional(),
});

export const ddPurchaseOrderUpdateSchema = ddPurchaseOrderCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddResourceAllocationCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  title: z.string().min(1, "Title is required"),
  resourceType: ddResourceTypeSchema.optional(),
  quantity: z.number().optional(),
  unit: z.string().nullable().optional(),
  status: ddResourceStatusSchema.optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: z.string().nullable().optional(),
});

export const ddResourceAllocationUpdateSchema = ddResourceAllocationCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const timelineRescheduleSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        plannedDate: z.string().nullable(),
      }),
    )
    .min(1),
});

export const shipyardSyncSchema = z.object({
  direction: z.enum(["pull", "push", "both"]).optional(),
});

export const ddApprovalRequestCreateSchema = z.object({
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  approvalType: z.string().min(1, "Approval type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  status: ddApprovalStatusSchema.optional(),
  requestedBy: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
  decidedAt: optionalDate,
});

export const ddApprovalRequestUpdateSchema = ddApprovalRequestCreateSchema
  .partial()
  .omit({ dryDockProjectId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddInputResponsibleRoleSchema = z.enum([
  "vessel",
  "superintendent",
  "shipyard",
  "purchase",
  "class",
  "accounts",
]);

export const ddInputSubmissionStatusSchema = z.enum([
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "rejected",
  "inactive",
]);

export const ddInputUpsertSchema = z.object({
  sectionKey: z.string().min(1, "Section is required"),
  valuesJson: z.record(z.string(), z.unknown()).default({}),
  enteredByRole: ddInputResponsibleRoleSchema,
  enteredByName: z.string().nullable().optional(),
  status: ddInputSubmissionStatusSchema.optional(),
});

export const ddInputReviewSchema = z.object({
  action: z.enum(["approve", "reject", "review"]),
  reviewerName: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
});

export const ddVesselJobStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "integrated",
  "rejected",
  "carry_forward",
]);

export const ddVesselJobSourceSchema = z.enum([
  "vessel",
  "pms",
  "class",
  "superintendent",
  "defect_report",
]);

export const ddVesselJobCreateSchema = z.object({
  vesselId: z.string().min(1, "Vessel is required"),
  targetDryDockProjectId: z.string().nullable().optional(),
  jobCode: z.string().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  workshop: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: ddJobPrioritySchema.optional(),
  source: ddVesselJobSourceSchema.optional(),
  status: ddVesselJobStatusSchema.optional(),
  createdByName: z.string().nullable().optional(),
  createdByRole: ddInputResponsibleRoleSchema.optional(),
  submit: z.boolean().optional(),
});

export const ddVesselJobUpdateSchema = ddVesselJobCreateSchema
  .partial()
  .omit({ vesselId: true })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddVesselJobIntegrateSchema = z.object({
  vesselJobIds: z.array(z.string().min(1)).min(1, "Select at least one job"),
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  integratedByName: z.string().nullable().optional(),
});

export const ddVesselJobRejectSchema = z.object({
  rejectedByName: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const ddVesselJobCarryForwardSchema = z.object({
  carryForwardReason: z.string().nullable().optional(),
});

export const ddVesselJobActionSchema = z.object({
  actorName: z.string().nullable().optional(),
});

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map((e) => e.message).join("; ");
    return { ok: false, error: msg };
  }
  return { ok: true, data: result.data };
}
