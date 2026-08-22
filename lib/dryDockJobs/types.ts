import type { DdJobPriority, DdSimpleJobFamily, DdSimpleJobStatus } from "@prisma/client";

export type DdSimpleJobPrepLineDto = {
  id: string;
  areaCode: string;
  areaLabel: string | null;
  prepMethodCode: string;
  prepMethodLabel: string | null;
  areaSqm: number;
  notes: string | null;
  sortOrder: number;
};

export type DdSimpleJobCoatLineDto = {
  id: string;
  areaCode: string;
  areaLabel: string | null;
  primerCoats: number;
  binderCoats: number;
  finishCoats: number;
  dftRequired: boolean;
  dftUm: number | null;
  notes: string | null;
  sortOrder: number;
};

export type DdSimpleJobDto = {
  id: string;
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  family: DdSimpleJobFamily;
  jobType: string;
  title: string;
  notes: string | null;
  priority: DdJobPriority;
  status: DdSimpleJobStatus;
  createdByEmployeeId: string | null;
  createdByName: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  prepLines: DdSimpleJobPrepLineDto[];
  coatLines: DdSimpleJobCoatLineDto[];
  totalPrepSqm: number;
  createdAt: string;
  updatedAt: string;
};

export type ListDdSimpleJobsQuery = {
  page?: number;
  limit?: number;
  vesselId?: string;
  status?: string;
  jobType?: string;
  search?: string;
};

export type DdSimpleJobPrepLineInput = {
  areaCode: string;
  areaLabel?: string | null;
  prepMethodCode: string;
  prepMethodLabel?: string | null;
  areaSqm: number;
  notes?: string | null;
  sortOrder?: number;
};

export type DdSimpleJobCoatLineInput = {
  areaCode: string;
  areaLabel?: string | null;
  primerCoats?: number;
  binderCoats?: number;
  finishCoats?: number;
  dftRequired?: boolean;
  dftUm?: number | null;
  notes?: string | null;
  sortOrder?: number;
};
