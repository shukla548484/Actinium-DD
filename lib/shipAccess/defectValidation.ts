import { z } from "zod";
import {
  VESSEL_DEFECT_EQUIPMENT_SYSTEMS,
  VESSEL_DEFECT_STATUSES,
} from "@/lib/shipAccess/crewDefectSystems";

const defectPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const vesselDefectEquipmentSystemSchema = z.enum(VESSEL_DEFECT_EQUIPMENT_SYSTEMS);

export const vesselDefectStatusSchema = z.enum(VESSEL_DEFECT_STATUSES);

export const vesselDefectCreateSchema = z.object({
  vesselId: z.string().min(1, "Vessel is required"),
  equipmentSystem: vesselDefectEquipmentSystemSchema,
  equipmentLabel: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  priority: defectPrioritySchema.optional(),
  reportedByName: z.string().nullable().optional(),
  submit: z.boolean().optional(),
});

export const vesselDefectUpdateSchema = vesselDefectCreateSchema
  .partial()
  .omit({ vesselId: true })
  .extend({
    cancel: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const vesselDefectMasterReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
});

export function parseDefectBody<T>(
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
