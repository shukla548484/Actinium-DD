import { z } from "zod";
import {
  VESSEL_REQUISITION_LINE_URGENCIES,
  VESSEL_REQUISITION_PURPOSES,
  VESSEL_REQUISITION_STATUSES,
  VESSEL_REQUISITION_TYPES,
  VESSEL_REQUISITION_UNITS,
} from "@/lib/shipAccess/requisitionTypes";

export const vesselRequisitionLineSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  quantity: z.number().positive("Quantity must be greater than zero").optional(),
  unit: z.enum(VESSEL_REQUISITION_UNITS).optional(),
  urgency: z.enum(VESSEL_REQUISITION_LINE_URGENCIES).optional(),
  equipmentLabel: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

export const vesselRequisitionCreateSchema = z.object({
  vesselId: z.string().min(1, "Vessel is required"),
  vesselDefectId: z.string().min(1, "Linked defect is required"),
  targetDryDockProjectId: z.string().nullable().optional(),
  heading: z.string().min(1, "Heading is required"),
  description: z.string().nullable().optional(),
  requisitionType: z.enum(VESSEL_REQUISITION_TYPES).optional(),
  requisitionPurpose: z.enum(VESSEL_REQUISITION_PURPOSES).optional(),
  portOfSupply: z.string().nullable().optional(),
  requestedByName: z.string().nullable().optional(),
  lines: z.array(vesselRequisitionLineSchema).min(1, "Add at least one line item"),
  submit: z.boolean().optional(),
});

export const vesselRequisitionUpdateSchema = vesselRequisitionCreateSchema
  .partial()
  .omit({ vesselId: true, vesselDefectId: true })
  .extend({
    cancel: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const vesselRequisitionMasterReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
});

export const vesselRequisitionIntegrateSchema = z.object({
  requisitionIds: z.array(z.string().min(1)).min(1, "Select at least one requisition"),
  dryDockProjectId: z.string().min(1, "Dry dock project is required"),
  convertedByName: z.string().nullable().optional(),
});

export const vesselRequisitionStatusSchema = z.enum(VESSEL_REQUISITION_STATUSES);

export function parseRequisitionBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map((e) => e.message).join("; ");
    return { ok: false, error: msg };
  }
  return { ok: true, data: result.data };
}
