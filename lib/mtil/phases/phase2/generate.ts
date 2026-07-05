import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { resolveDynamicTemplate, getDynamicTemplateDef } from "../../dynamicTemplateEngine";
import { buildMtilJobCode, buildJobId, jobTitle } from "../../ids";
import { MTIL_PROJECT_TYPES, MTIL_VESSEL_TYPES } from "../../standards";
import type { MtilDeptCode, MtilSystemCode } from "../../standards";
import {
  ACTION_MANHOUR_FACTOR,
  ACTION_PRIORITY,
  defaultBudgetMapping,
  defaultRfqMapping,
  defaultSparesForOverhaul,
} from "../../mappings";
import type { MtilJobDefinition, MtilNodeMeta, MtilMachineryDef } from "../../types";
import { PHASE2_AUXILIARY_SYSTEMS, type Phase2SystemMeta } from "./auxiliaryMachinery";

const PHASE = 2 as const;
const DEPARTMENT = "Auxiliary Machinery";

function commercialKey(dept: MtilDeptCode, system: MtilSystemCode): string {
  return `${dept}:${system}`;
}

/** Expand component × action matrix into canonical MTIL job rows. */
export function generatePhase2JobDefinitions(): MtilJobDefinition[] {
  const jobs: MtilJobDefinition[] = [];
  const seqByKey = new Map<string, number>();
  const jobSeqByCommercial = new Map<string, number>();

  for (const system of PHASE2_AUXILIARY_SYSTEMS) {
    for (const machinery of system.machinery) {
      for (const component of machinery.components) {
        const templateKey = component.dynamicTemplateKey ?? "ae_general_inspect";
        const templateDef = getDynamicTemplateDef(templateKey);
        const baseHours = component.estimatedManhoursBase ?? 8;

        for (const action of component.actions) {
          const seqKey = `${system.code}-${component.code}-${action}`;
          const seq = (seqByKey.get(seqKey) ?? 0) + 1;
          seqByKey.set(seqKey, seq);

          const ck = commercialKey(system.commercialDept, system.commercialSystem);
          const jobSeq = (jobSeqByCommercial.get(ck) ?? 0) + 1;
          jobSeqByCommercial.set(ck, jobSeq);

          const mtilJobCode = buildMtilJobCode({
            phase: PHASE,
            systemCode: system.code,
            componentCode: component.code,
            action,
            sequence: seq,
          });
          const jobId = buildJobId(system.commercialDept, system.commercialSystem, jobSeq);

          const factor = ACTION_MANHOUR_FACTOR[action] ?? 1;
          const estimatedManhours = Math.round(baseHours * factor);

          jobs.push({
            jobId,
            mtilJobCode,
            phase: PHASE,
            department: DEPARTMENT,
            systemCode: system.code,
            systemName: system.name,
            machineryCode: machinery.code,
            machineryName: machinery.name,
            componentCode: component.code,
            componentName: component.name,
            subComponent: component.name,
            action,
            title: jobTitle(component.name, action),
            description: `${system.name} / ${machinery.name} — ${action} scope item`,
            workshop: system.workshop,
            templateId: templateDef?.templateId ?? "",
            dynamicTemplateKey: templateKey,
            vesselTypeApplicability: [...MTIL_VESSEL_TYPES],
            projectTypeApplicability: [...MTIL_PROJECT_TYPES],
            defaultPriority: component.priority ?? ACTION_PRIORITY[action] ?? "medium",
            estimatedManhours,
            referenceCode: jobId,
            classHoldPoint: templateDef?.classHoldPoint ?? false,
            qaQcHoldPoint: templateDef?.qaQcRequired ?? false,
            permitRequired: templateDef?.permitRequired ?? false,
            responsibleUser: "Chief Engineer",
            approvalWorkflow: templateDef?.approvalWorkflow ?? ["crew_submit", "ce_review", "master_review"],
            requiredAttachments: templateDef?.requiredAttachments ?? [],
            requiredPhotos: templateDef?.photoSlots ?? ["before", "after"],
            requiredReports: templateDef?.requiredReports ?? [],
            measurementRefs: component.measurementRefs ?? templateDef?.measurementRefs,
            checklistRefs: templateDef?.checklistRefs,
            rfqMapping: defaultRfqMapping({
              systemName: system.name,
              componentName: component.name,
              workshop: system.workshop,
              jobSeq,
            }),
            budgetMapping: defaultBudgetMapping({
              workshop: system.workshop,
              systemCode: system.code,
              jobSeq,
            }),
            ...(action === "overhaul" || action === "renew"
              ? { sparesRefs: defaultSparesForOverhaul(component.name).map((s) => s.code) }
              : {}),
          });
        }
      }
    }
  }

  return jobs;
}

function jobToSeedNode(job: MtilJobDefinition): JobLibrarySeedNode & { mtilMeta: MtilNodeMeta } {
  const mtilMeta: MtilNodeMeta = {
    phase: job.phase,
    jobId: job.jobId,
    mtilJobCode: job.mtilJobCode,
    templateId: job.templateId,
    dynamicTemplateKey: job.dynamicTemplateKey,
    action: job.action,
    subComponent: job.subComponent,
    measurementRefs: job.measurementRefs,
    checklistRefs: job.checklistRefs,
    rfqMapping: job.rfqMapping,
    budgetMapping: job.budgetMapping,
    classHoldPoint: job.classHoldPoint,
    qaQcHoldPoint: job.qaQcHoldPoint,
    vesselTypeApplicability: job.vesselTypeApplicability,
    projectTypeApplicability: job.projectTypeApplicability,
    approvalWorkflow: job.approvalWorkflow,
  };

  return {
    code: job.mtilJobCode.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60),
    name: job.title,
    nodeType: "standard_job",
    description: job.description,
    department: job.department,
    workshop: job.workshop,
    referenceCode: job.referenceCode ?? job.jobId,
    defaultPriority: job.defaultPriority,
    estimatedManhours: job.estimatedManhours,
    inputTemplate: resolveDynamicTemplate(job.dynamicTemplateKey),
    mtilPhase: job.phase,
    mtilJobCode: job.jobId,
    dynamicTemplateKey: job.dynamicTemplateKey,
    mtilMeta,
  };
}

/** Build JobLibrary tree for Phase 2 auxiliary machinery. */
export function generatePhase2JobLibraryTree(): JobLibrarySeedNode & {
  mtilMeta?: { phase: number; generatedJobCount: number };
} {
  const jobs = generatePhase2JobDefinitions();

  const systemsMap = new Map<
    string,
    {
      system: Phase2SystemMeta;
      machinery: Map<
        string,
        { machinery: Phase2SystemMeta["machinery"][0]; components: Map<string, MtilJobDefinition[]> }
      >;
    }
  >();

  for (const job of jobs) {
    let sys = systemsMap.get(job.systemCode);
    if (!sys) {
      const systemDef = PHASE2_AUXILIARY_SYSTEMS.find((s) => s.code === job.systemCode)!;
      sys = { system: systemDef, machinery: new Map() };
      systemsMap.set(job.systemCode, sys);
    }
    let mach = sys.machinery.get(job.machineryCode);
    if (!mach) {
      const machDef = sys.system.machinery.find((m: MtilMachineryDef) => m.code === job.machineryCode)!;
      mach = { machinery: machDef, components: new Map() };
      sys.machinery.set(job.machineryCode, mach);
    }
    const list = mach.components.get(job.componentCode) ?? [];
    list.push(job);
    mach.components.set(job.componentCode, list);
  }

  const systemNodes: JobLibrarySeedNode[] = [...systemsMap.values()].map(({ system, machinery }) => ({
    code: system.code.toLowerCase(),
    name: system.name,
    nodeType: "system" as const,
    workshop: system.workshop,
    children: [...machinery.values()].map(({ machinery: mach, components }) => ({
      code: mach.code.toLowerCase(),
      name: mach.name,
      nodeType: "machinery" as const,
      children: [...components.entries()].map(([compCode, compJobs]) => ({
        code: compCode.toLowerCase(),
        name: compJobs[0]!.componentName,
        nodeType: "component" as const,
        children: compJobs.map((j) => jobToSeedNode(j)),
      })),
    })),
  }));

  return {
    code: "mtil_p2_auxiliary_machinery",
    name: "Auxiliary Machinery (MTIL Phase 2)",
    nodeType: "department",
    department: DEPARTMENT,
    description: `MTIL Phase 2 v0.2 — ${jobs.length} generated standardized jobs`,
    children: [
      {
        code: "auxiliary_machinery",
        name: "Auxiliary Machinery",
        nodeType: "category",
        department: DEPARTMENT,
        children: systemNodes,
      },
    ],
    mtilMeta: { phase: 2, generatedJobCount: jobs.length },
  };
}

export function getPhase2Stats() {
  const jobs = generatePhase2JobDefinitions();
  const catalogTemplates = new Set(
    jobs.map((j) => j.dynamicTemplateKey).filter((k) => !k.startsWith("ae_general")),
  );
  return {
    phase: 2,
    engineVersion: "0.2.0",
    jobCount: jobs.length,
    catalogTemplateCount: 25,
    dynamicTemplateCount: new Set(jobs.map((j) => j.dynamicTemplateKey)).size,
    systemCount: PHASE2_AUXILIARY_SYSTEMS.length,
    componentCount: new Set(jobs.map((j) => j.componentCode)).size,
    measurementCount: new Set(jobs.flatMap((j) => j.measurementRefs ?? [])).size,
    catalogTemplatesUsed: catalogTemplates.size,
    aeJobCount: jobs.filter((j) => j.jobId.startsWith("JOB-AUX-AE-")).length,
    blrJobCount: jobs.filter((j) => j.jobId.startsWith("JOB-AUX-BLR-")).length,
  };
}
