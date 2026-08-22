import { z } from "zod";
import {
  DD_SIMPLE_JOB_STATUSES,
  DD_SIMPLE_PAINT_JOB_TYPES,
  DD_SIMPLE_PREP_METHODS,
} from "@/lib/dryDockJobs/catalog";

const jobTypeCodes = DD_SIMPLE_PAINT_JOB_TYPES.map((t) => t.code) as [
  (typeof DD_SIMPLE_PAINT_JOB_TYPES)[number]["code"],
  ...(typeof DD_SIMPLE_PAINT_JOB_TYPES)[number]["code"][],
];

const prepMethodCodes = DD_SIMPLE_PREP_METHODS.map((m) => m.code) as [
  (typeof DD_SIMPLE_PREP_METHODS)[number]["code"],
  ...(typeof DD_SIMPLE_PREP_METHODS)[number]["code"][],
];

const prioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const ddSimpleJobPrepLineSchema = z.object({
  areaCode: z.string().min(1, "Area is required"),
  areaLabel: z.string().nullable().optional(),
  prepMethodCode: z.enum(prepMethodCodes),
  prepMethodLabel: z.string().nullable().optional(),
  areaSqm: z.number().positive("Area m² must be greater than 0"),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const ddSimpleJobCoatLineSchema = z.object({
  areaCode: z.string().min(1, "Area is required"),
  areaLabel: z.string().nullable().optional(),
  primerCoats: z.number().int().min(0).max(20).optional(),
  binderCoats: z.number().int().min(0).max(20).optional(),
  finishCoats: z.number().int().min(0).max(20).optional(),
  dftRequired: z.boolean().optional(),
  dftUm: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const ddSimpleJobCreateSchema = z
  .object({
    vesselId: z.string().min(1, "Vessel is required"),
    family: z.literal("paint").optional(),
    jobType: z.enum(jobTypeCodes),
    title: z.string().min(1, "Title is required"),
    notes: z.string().nullable().optional(),
    priority: prioritySchema.optional(),
    createdByName: z.string().nullable().optional(),
    prepLines: z.array(ddSimpleJobPrepLineSchema).default([]),
    coatLines: z.array(ddSimpleJobCoatLineSchema).default([]),
    submit: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.jobType === "hull_paint" && data.prepLines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hull Paint requires at least one prep line (area × Sa grade × m²)",
        path: ["prepLines"],
      });
    }
    for (const [i, line] of data.coatLines.entries()) {
      if (line.dftRequired && (line.dftUm == null || line.dftUm <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DFT µm is required when DFT Required is yes",
          path: ["coatLines", i, "dftUm"],
        });
      }
    }
  });

export const ddSimpleJobUpdateSchema = ddSimpleJobCreateSchema
  .partial()
  .omit({ vesselId: true })
  .extend({
    cancel: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const ddSimpleJobMasterReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
});

export const ddSimpleJobStatusSchema = z.enum(DD_SIMPLE_JOB_STATUSES);

export function parseDdSimpleJobBody<T>(
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
