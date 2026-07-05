import type { DryDockProjectType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getJobCatalogTemplateDetail } from "@/lib/db/jobCatalogStats";

export type MtilJobListFilters = {
  machinery?: string;
  component?: string;
  templateId?: string;
  projectType?: DryDockProjectType;
  vesselType?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
};

export async function listMtilMasterJobs(filters: MtilJobListFilters = {}) {
  const where: Prisma.MasterJobLibraryWhereInput = {};

  if (filters.machinery) where.machinery = { contains: filters.machinery, mode: "insensitive" };
  if (filters.component) where.component = { contains: filters.component, mode: "insensitive" };
  if (filters.templateId) where.templateId = filters.templateId;
  if (filters.activeOnly !== false) where.activeFlag = true;
  if (filters.projectType) where.applicableProjectTypes = { has: filters.projectType };
  if (filters.vesselType) {
    where.OR = [
      { applicableVesselTypes: { has: filters.vesselType } },
      { applicableVesselTypes: { has: "All Types" } },
      { applicableVesselTypes: { has: "All" } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.masterJobLibrary.findMany({
      where,
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
      orderBy: { jobId: "asc" },
      select: {
        jobId: true,
        libraryVersion: true,
        department: true,
        systemGroup: true,
        machinery: true,
        component: true,
        subComponent: true,
        standardJobName: true,
        jobDescription: true,
        applicableVesselTypes: true,
        applicableProjectTypes: true,
        surveyType: true,
        workshop: true,
        templateId: true,
        measurementSetId: true,
        inspectionChecklistId: true,
        scopeOfWorkId: true,
        rfqCategory: true,
        budgetCategory: true,
        dryDockCostCode: true,
        mandatoryFlag: true,
        classHoldPoint: true,
        riskLevel: true,
        activeFlag: true,
        template: {
          select: {
            templateName: true,
            templateCategory: true,
            version: true,
          },
        },
      },
    }),
    prisma.masterJobLibrary.count({ where }),
  ]);

  return { jobs, total };
}

export async function getMtilTemplateDetail(templateId: string) {
  return getJobCatalogTemplateDetail(templateId);
}

export async function listMtilScopeStepsForTemplate(templateId: string) {
  return prisma.jobScopeStep.findMany({
    where: { templateId },
    orderBy: { sequenceNo: "asc" },
  });
}
