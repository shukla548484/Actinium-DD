import type { DdVesselJobStatus, Prisma } from "@prisma/client";
import type { z } from "zod";
import type {
  ddVesselJobCollaborateSchema,
  ddVesselJobCreateSchema,
  ddVesselJobUpdateSchema,
} from "@/lib/superintendent/validation";

type CreateInput = z.infer<typeof ddVesselJobCreateSchema>;
type UpdateInput = z.infer<typeof ddVesselJobUpdateSchema>;
type CollaborateInput = z.infer<typeof ddVesselJobCollaborateSchema>;

function coerceDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

export function mapVesselJobCreateInput(
  data: CreateInput,
  vesselId: string,
  status: DdVesselJobStatus,
) {
  const { submit: _submit, vesselId: _vId, lastOverhaulDate, measurements, formData, ...rest } =
    data;
  return {
    ...rest,
    vesselId,
    status,
    lastOverhaulDate: coerceDate(lastOverhaulDate),
    measurements: measurements as Prisma.InputJsonValue | undefined,
    formData: formData as Prisma.InputJsonValue | undefined,
  };
}

export function mapVesselJobCollaborateInput(
  data: CollaborateInput,
  vesselId: string,
  status: DdVesselJobStatus,
) {
  const {
    submit: _submit,
    vesselId: _vId,
    standardJobLibraryIds,
    memberScopes,
    lastOverhaulDate,
    measurements,
    formData,
    estimatedManhours: _estimatedManhours,
    ...rest
  } = data;
  return {
    ...rest,
    vesselId,
    status,
    standardJobLibraryIds,
    memberScopes,
    lastOverhaulDate: coerceDate(lastOverhaulDate) ?? null,
    measurements: measurements as Prisma.InputJsonValue | undefined,
    formData: (formData ?? null) as Record<string, unknown> | null,
  };
}

export function mapVesselJobUpdateInput(data: UpdateInput) {
  const { submit: _submit, lastOverhaulDate, measurements, formData, ...rest } = data;
  return {
    ...rest,
    ...(lastOverhaulDate !== undefined ? { lastOverhaulDate: coerceDate(lastOverhaulDate) } : {}),
    ...(measurements !== undefined
      ? { measurements: measurements as Prisma.InputJsonValue }
      : {}),
    ...(formData !== undefined ? { formData: formData as Prisma.InputJsonValue } : {}),
  };
}
