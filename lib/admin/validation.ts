import { z } from "zod";
import { getDesignationByLabel } from "@/lib/admin/designations";
import { PHONE_E164_REGEX } from "@/lib/admin/phone";

export const entityStatusSchema = z.enum(["active", "wait", "inactive"]);

export const companyCategorySchema = z.enum([
  "shipyard",
  "ship_management",
  "ship_owner",
  "other",
]);

export const companyCreateSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  category: companyCategorySchema,
  type: z.enum(["MASTER", "SUB"]).optional(),
  parentId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  contactPhone: z.string().nullable().optional(),
  status: entityStatusSchema.optional(),
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const vesselCreateSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  name: z.string().min(2, "Vessel name is required"),
  code: z.string().optional(),
  imoNumber: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  vesselType: z.string().nullable().optional(),
  callSign: z.string().nullable().optional(),
  grossTonnage: z.number().nullable().optional(),
  yearBuilt: z.number().int().min(1900).max(2100).nullable().optional(),
  status: entityStatusSchema.optional(),
});

export const vesselUpdateSchema = vesselCreateSchema.partial().omit({ companyId: true }).extend({
  companyId: z.string().optional(),
});

const employeeEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

const employeePhoneSchema = z
  .string()
  .trim()
  .regex(PHONE_E164_REGEX, "Phone must include country code and a 10-digit number");

const employeeDesignationSchema = z
  .string()
  .trim()
  .min(1, "Designation is required")
  .refine((value) => Boolean(getDesignationByLabel(value)), {
    message: "Select a valid designation from the list",
  });

export const employeeCreateSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: employeeEmailSchema,
  phone: employeePhoneSchema,
  designation: employeeDesignationSchema,
  department: z.string().trim().nullable().optional(),
  status: entityStatusSchema.optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().extend({
  phone: employeePhoneSchema.optional(),
  designation: z.string().trim().min(1, "Designation is required").optional(),
  email: employeeEmailSchema.optional(),
});

export const assignVesselsSchema = z.object({
  vesselIds: z.array(z.string()).min(1, "Select at least one vessel"),
  watchKeeperVesselIds: z.array(z.string()).optional(),
});

export const statusBodySchema = z.object({
  status: entityStatusSchema,
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
