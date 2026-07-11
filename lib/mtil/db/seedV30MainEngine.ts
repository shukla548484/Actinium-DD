import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildEmdrMasterRepositoryTree,
} from "@/lib/emdr/v3/buildJobLibraryTree";
import { importV30MasterRepositoryFromParsed } from "@/lib/emdr/v3/importMasterRepository";
import {
  loadEmdrMasterRepositoryParsed,
} from "@/lib/emdr/v3/loadEmdrMasterRepository";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import {
  getEmdrMasterRepositoryReleaseConfig,
  MTIL_V30_TREE_CODE,
  MTIL_V31_TREE_CODE,
  MTIL_V32_TREE_CODE,
  MTIL_V33_TREE_CODE,
  MTIL_V34_TREE_CODE,
  MTIL_V36_TREE_CODE,
  MTIL_V37_TREE_CODE,
  MTIL_V38_TREE_CODE,
  MTIL_V39_TREE_CODE,
  MTIL_V310_TREE_CODE,
  MTIL_V311_TREE_CODE,
  MTIL_V312_TREE_CODE,
  type EmdrMasterRepositoryReleaseConfig,
} from "@/lib/emdr/v3/sheets";
import {
  isEmdrMasterRepositoryPresent,
  resolveEmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import { resolveLoadedEmdrMasterRepositoryKind } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import { MTIL_V201_TREE_CODE } from "@/lib/mtil/v2/sprints/registry";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { validateEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import { isV323TypewiseFfsJobId } from "@/lib/emdr/v3/parseV323FireLsaSafetyRepository";
import { isV324TypewisePropJobId } from "@/lib/emdr/v3/parseV324PropulsionShaftingRepository";
import { isV325TypewiseHvacJobId } from "@/lib/emdr/v3/parseV325HvacVentilationRepository";
import { isV326TypewiseAutoJobId } from "@/lib/emdr/v3/parseV326AutomationIasRepository";
import { isV327TypewiseVpsoJobId } from "@/lib/emdr/v3/parseV327ValvesPipingRepository";
import { isV328TypewiseNavcomJobId } from "@/lib/emdr/v3/parseV328NavigationCommunicationRepository";
import { isV329TypewiseTgliJobId } from "@/lib/emdr/v3/parseV329TankGaugingRepository";
import { isV330TypewiseHypnJobId } from "@/lib/emdr/v3/parseV330HydraulicPneumaticRepository";
import { isV331TypewiseAglhJobId } from "@/lib/emdr/v3/parseV331AccommodationRepository";
import { isV332TypewiseWmtpJobId } from "@/lib/emdr/v3/parseV332WorkshopMachineryRepository";
import { isV333TypewiseDfmtJobId } from "@/lib/emdr/v3/parseV333DeckFittingsRepository";
import { isV334TypewiseHullJobId } from "@/lib/emdr/v3/parseV334HullStructureRepository";
import { isV335TypewiseChhcJobId } from "@/lib/emdr/v3/parseV335CargoHoldRepository";
import { isV336TypewiseDwssJobId } from "@/lib/emdr/v3/parseV336DomesticWaterRepository";
import { isV337TypewiseScacsJobId } from "@/lib/emdr/v3/parseV337SecurityCctvRepository";
import { isV339TypewiseSvssJobId } from "@/lib/emdr/v3/parseV339SpecialVesselRepository";
import { isV340TypewiseCsstJobId } from "@/lib/emdr/v3/parseV340ClassStatutoryRepository";
import { isV341TypewiseEdmcJobId } from "@/lib/emdr/v3/parseV341GapClosureRepository";
import { validateMtilWorkbook } from "@/lib/mtil/import/validateWorkbook";

/** V2.0.1 sprint prefixes superseded by V3.x — deactivated on seed to prevent duplicate picker entries. */
const V201_SUPERSEDED_JOB_PREFIXES = [
  "JOBS-ME-CYU-",
  "JOB-ME-CYU-",
  "JOBS-ME-FIS-",
  "JOB-ME-FIS-",
  "JOBS-ME-EVS-",
  "JOB-ME-EVS-",
  "JOBS-ME-TCH-",
  "JOB-ME-TCH-",
  "JOBS-ME-CRK-",
  "JOB-ME-CRK-",
];

const SUPERSEDED_EMDR_TREE_CODES = [
  MTIL_V201_TREE_CODE,
  MTIL_V30_TREE_CODE,
  MTIL_V31_TREE_CODE,
  MTIL_V32_TREE_CODE,
  MTIL_V33_TREE_CODE,
  MTIL_V34_TREE_CODE,
  MTIL_V36_TREE_CODE,
  MTIL_V37_TREE_CODE,
  MTIL_V38_TREE_CODE,
  MTIL_V39_TREE_CODE,
  MTIL_V310_TREE_CODE,
  MTIL_V311_TREE_CODE,
  MTIL_V312_TREE_CODE,
];

async function releaseMtilJobCodeSlot(mtilJobCode: string | null | undefined, keepId?: string) {
  if (!mtilJobCode) return;
  await prisma.jobLibraryNode.updateMany({
    where: {
      mtilJobCode,
      ...(keepId ? { id: { not: keepId } } : {}),
    },
    data: { mtilJobCode: null },
  });
}

async function findExistingSeedChildNode(parentId: string, child: JobLibrarySeedNode) {
  const atParent = await prisma.jobLibraryNode.findFirst({
    where: { parentId, code: child.code },
    orderBy: { updatedAt: "desc" },
  });
  if (atParent) return atParent;

  if (child.nodeType !== "standard_job") return null;

  const lookup: Prisma.JobLibraryNodeWhereInput[] = [];
  if (child.mtilJobCode) lookup.push({ mtilJobCode: child.mtilJobCode });
  if (child.referenceCode) lookup.push({ referenceCode: child.referenceCode });
  if (lookup.length === 0) return null;

  return prisma.jobLibraryNode.findFirst({
    where: { OR: lookup },
    orderBy: { updatedAt: "desc" },
  });
}

async function insertNode(
  node: JobLibrarySeedNode,
  parentId: string | null,
  sortOrder: number,
): Promise<string> {
  const created = await prisma.jobLibraryNode.create({
    data: {
      parentId,
      nodeType: node.nodeType,
      code: node.code,
      name: node.name,
      description: node.description ?? null,
      department: node.department ?? null,
      workshop: node.workshop ?? null,
      sortOrder,
      referenceCode: node.referenceCode ?? null,
      defaultPriority: node.defaultPriority ?? null,
      estimatedManhours: node.estimatedManhours ?? null,
      inputTemplate: (node.inputTemplate ?? null) as Prisma.InputJsonValue,
      mtilPhase: node.mtilPhase ?? null,
      mtilJobCode: node.mtilJobCode ?? null,
      dynamicTemplateKey: node.dynamicTemplateKey ?? null,
      mtilMeta: (node.mtilMeta ?? null) as Prisma.InputJsonValue,
    },
  });

  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    await insertNode(node.children![i]!, created.id, i);
  }

  return created.id;
}

async function mergeChildNodes(parentId: string, children: JobLibrarySeedNode[]) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const existing = await findExistingSeedChildNode(parentId, child);

    if (existing) {
      if (existing.deletedAt) {
        await prisma.jobLibraryNode.update({
          where: { id: existing.id },
          data: { deletedAt: null, isActive: true },
        });
      }
      if (child.nodeType === "standard_job") {
        await releaseMtilJobCodeSlot(child.mtilJobCode ?? null, existing.id);
        await prisma.jobLibraryNode.update({
          where: { id: existing.id },
          data: {
            parentId,
            sortOrder: i,
            name: child.name,
            description: child.description ?? null,
            referenceCode: child.referenceCode ?? null,
            defaultPriority: child.defaultPriority ?? null,
            estimatedManhours: child.estimatedManhours ?? null,
            mtilPhase: child.mtilPhase ?? null,
            mtilJobCode: child.mtilJobCode ?? null,
            dynamicTemplateKey: child.dynamicTemplateKey ?? null,
            mtilMeta: (child.mtilMeta ?? null) as Prisma.InputJsonValue,
            isActive: true,
          },
        });
      }
      if (child.children?.length) {
        await mergeChildNodes(existing.id, child.children);
      }
    } else {
      await insertNode(child, parentId, i);
    }
  }
}

async function retireDuplicateStandardJobNodes() {
  const duplicates = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      deletedAt: null,
      referenceCode: { not: null },
    },
    select: { id: true, referenceCode: true, mtilJobCode: true },
    orderBy: [{ referenceCode: "asc" }, { mtilJobCode: "desc" }],
  });

  const keepByReference = new Map<string, string>();
  const staleIds: string[] = [];
  for (const node of duplicates) {
    const ref = node.referenceCode!;
    const keptId = keepByReference.get(ref);
    if (!keptId) {
      keepByReference.set(ref, node.id);
      continue;
    }
    if (node.mtilJobCode) {
      staleIds.push(keptId);
      keepByReference.set(ref, node.id);
      continue;
    }
    staleIds.push(node.id);
  }

  if (staleIds.length === 0) return 0;

  await prisma.jobLibraryNode.updateMany({
    where: { id: { in: staleIds } },
    data: { deletedAt: new Date(), isActive: false, mtilJobCode: null, referenceCode: null },
  });
  return staleIds.length;
}

async function softDeleteSubtree(rootId: string) {
  const nodes = await prisma.jobLibraryNode.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string | null, string[]>();
  for (const node of nodes) {
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parentId, list);
  }

  const toDelete: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    toDelete.push(id);
    for (const childId of childrenByParent.get(id) ?? []) stack.push(childId);
  }

  if (toDelete.length === 0) return 0;

  await prisma.jobLibraryNode.updateMany({
    where: { id: { in: toDelete } },
    data: { deletedAt: new Date(), isActive: false, mtilJobCode: null },
  });
  return toDelete.length;
}

async function retireSupersededEmdrTrees(activeTreeCode: string) {
  let retired = 0;
  for (const code of SUPERSEDED_EMDR_TREE_CODES) {
    if (code === activeTreeCode) continue;
    const root = await prisma.jobLibraryNode.findFirst({
      where: { code, deletedAt: null },
    });
    if (root) retired += await softDeleteSubtree(root.id);
  }
  return retired;
}

async function deactivateSupersededV201Jobs() {
  let deactivated = 0;
  for (const prefix of V201_SUPERSEDED_JOB_PREFIXES) {
    const result = await prisma.masterJobLibrary.updateMany({
      where: { jobId: { startsWith: prefix }, activeFlag: true },
      data: { activeFlag: false },
    });
    deactivated += result.count;
  }
  return deactivated;
}

async function ensureEmdrRootNode(config: EmdrMasterRepositoryReleaseConfig): Promise<string> {
  let root = await prisma.jobLibraryNode.findFirst({
    where: { code: config.treeCode, deletedAt: null },
  });

  if (!root) {
    const maxSort = await prisma.jobLibraryNode.aggregate({
      where: { parentId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    const rootId = await insertNode(
      {
        code: config.treeCode,
        name: config.treeName,
        nodeType: "department",
        department: "Main Propulsion",
        description: `${config.release} — EMDR master repository`,
        children: [],
      },
      null,
      (maxSort._max.sortOrder ?? -1) + 1,
    );
    root = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id: rootId } });
  }

  return root.id;
}

async function ensureCategoryNode(
  rootId: string,
  category: JobLibrarySeedNode,
): Promise<string> {
  let node = await prisma.jobLibraryNode.findFirst({
    where: { parentId: rootId, code: category.code, deletedAt: null },
  });

  if (!node) {
    const id = await insertNode({ ...category, children: [] }, rootId, 0);
    node = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id } });
  }

  return node.id;
}

async function linkMasterJobsToNodes(mtilPhase: number) {
  const nodes = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      mtilPhase,
      OR: [
        { referenceCode: { startsWith: "JOBS-ME-" } },
        { referenceCode: { startsWith: "JOBS-AE-" } },
        { referenceCode: { startsWith: "JOBS-BLR-" } },
        { referenceCode: { startsWith: "JOBS-PMP-" } },
        { referenceCode: { startsWith: "JOBS-CMP-" } },
        { referenceCode: { startsWith: "JOBS-PUR-" } },
        { referenceCode: { startsWith: "JOBS-V36-" } },
        { referenceCode: { startsWith: "JOBS-V37-" } },
        { referenceCode: { startsWith: "JOBS-V38-" } },
        { referenceCode: { startsWith: "JOBS-DMW-" } },
        { referenceCode: { startsWith: "JOBS-LSA-" } },
        { referenceCode: { startsWith: "JOBS-FFS-" } },
        { referenceCode: { startsWith: "JOBS-IGG-" } },
        { referenceCode: { startsWith: "JOBS-ACSA-" } },
        { referenceCode: { startsWith: "JOBS-STG-" } },
        { referenceCode: { startsWith: "JOBS-RUD-" } },
        { referenceCode: { startsWith: "JOBS-ANO-" } },
        { referenceCode: { startsWith: "JOBS-ICCP-" } },
        { referenceCode: { startsWith: "JOBS-MGPS-" } },
        { referenceCode: { startsWith: "JOBS-ANC-" } },
        { referenceCode: { startsWith: "JOBS-VRCS-" } },
        { referenceCode: { startsWith: "JOBS-DMK-" } },
        { referenceCode: { startsWith: "JOBS-EMO-" } },
        { referenceCode: { startsWith: "JOBS-PCS-" } },
        { referenceCode: { startsWith: "JOBS-PUMP-" } },
        { referenceCode: { startsWith: "JOBS-HEX-" } },
        { referenceCode: { startsWith: "JOBS-IGS-" } },
        { referenceCode: { startsWith: "JOBS-ENV-" } },
        { referenceCode: { startsWith: "JOBS-EPD-" } },
        { referenceCode: { startsWith: "JOBS-PROP-" } },
        { referenceCode: { startsWith: "JOBS-HVAC-" } },
        { referenceCode: { startsWith: "JOBS-AUTO-" } },
        { referenceCode: { startsWith: "JOBS-VPSO-" } },
        { referenceCode: { startsWith: "JOBS-NAVCOM-" } },
        { referenceCode: { startsWith: "JOBS-TGLI-" } },
        { referenceCode: { startsWith: "JOBS-HYPN-" } },
        { referenceCode: { startsWith: "JOBS-AGLH-" } },
        { referenceCode: { startsWith: "JOBS-WMTP-" } },
        { referenceCode: { startsWith: "JOBS-DFMT-" } },
        { referenceCode: { startsWith: "JOBS-HULL-" } },
        { referenceCode: { startsWith: "JOBS-CHHC-" } },
        { referenceCode: { startsWith: "JOBS-DWSS-" } },
        { referenceCode: { startsWith: "JOBS-SCACS-" } },
        { referenceCode: { startsWith: "JOBS-SVSS-" } },
        { referenceCode: { startsWith: "JOBS-CSST-" } },
        { referenceCode: { startsWith: "JOBS-EDMC-" } },
      ],
      deletedAt: null,
    },
    select: { id: true, referenceCode: true, mtilJobCode: true },
  });

  const nodesByReference = new Map<string, (typeof nodes)[number]>();
  for (const node of nodes) {
    if (!node.referenceCode) continue;
    const existing = nodesByReference.get(node.referenceCode);
    if (!existing) {
      nodesByReference.set(node.referenceCode, node);
      continue;
    }
    if (node.mtilJobCode && !existing.mtilJobCode) {
      nodesByReference.set(node.referenceCode, node);
    }
  }

  let linked = 0;
  for (const n of nodesByReference.values()) {
    const updated = await prisma.masterJobLibrary.updateMany({
      where: { jobId: n.referenceCode! },
      data: { jobLibraryNodeId: n.id, activeFlag: true },
    });
    linked += updated.count;
  }
  return linked;
}

export function getV30MasterRepositoryStats(): ParsedV3MasterRepository | null {
  try {
    return loadEmdrMasterRepositoryParsed();
  } catch {
    return null;
  }
}

export async function isEmdrMasterRepositorySeeded(): Promise<boolean> {
  const kind = resolveLoadedEmdrMasterRepositoryKind() ?? resolveEmdrMasterRepositoryKind();
  if (!kind) return false;
  const config = getEmdrMasterRepositoryReleaseConfig(kind);
  const root = await prisma.jobLibraryNode.findFirst({
    where: { code: config.treeCode, deletedAt: null, isActive: true },
  });
  if (!root) return false;

  const parsed = getV30MasterRepositoryStats();
  if (!parsed) return false;

  const activeJobs = await prisma.masterJobLibrary.count({
    where: {
      OR: [
        { jobId: { startsWith: "JOBS-ME-" } },
        { jobId: { startsWith: "JOBS-AE-" } },
        { jobId: { startsWith: "JOBS-BLR-" } },
        { jobId: { startsWith: "JOBS-PMP-" } },
        { jobId: { startsWith: "JOBS-CMP-" } },
        { jobId: { startsWith: "JOBS-PUR-" } },
        { jobId: { startsWith: "JOBS-V36-" } },
        { jobId: { startsWith: "JOBS-V37-" } },
        { jobId: { startsWith: "JOBS-V38-" } },
        { jobId: { startsWith: "JOBS-DMW-" } },
        { jobId: { startsWith: "JOBS-LSA-" } },
        { jobId: { startsWith: "JOBS-FFS-" } },
        { jobId: { startsWith: "JOBS-IGG-" } },
        { jobId: { startsWith: "JOBS-ACSA-" } },
        { jobId: { startsWith: "JOBS-STG-" } },
        { jobId: { startsWith: "JOBS-RUD-" } },
        { jobId: { startsWith: "JOBS-ANO-" } },
        { jobId: { startsWith: "JOBS-ICCP-" } },
        { jobId: { startsWith: "JOBS-MGPS-" } },
        { jobId: { startsWith: "JOBS-ANC-" } },
        { jobId: { startsWith: "JOBS-VRCS-" } },
        { jobId: { startsWith: "JOBS-DMK-" } },
        { jobId: { startsWith: "JOBS-EMO-" } },
        { jobId: { startsWith: "JOBS-PCS-" } },
        { jobId: { startsWith: "JOBS-PUMP-" } },
        { jobId: { startsWith: "JOBS-HEX-" } },
        { jobId: { startsWith: "JOBS-IGS-" } },
        { jobId: { startsWith: "JOBS-ENV-" } },
        { jobId: { startsWith: "JOBS-EPD-" } },
        { jobId: { startsWith: "JOBS-PROP-" } },
        { jobId: { startsWith: "JOBS-HVAC-" } },
        { jobId: { startsWith: "JOBS-AUTO-" } },
        { jobId: { startsWith: "JOBS-VPSO-" } },
        { jobId: { startsWith: "JOBS-NAVCOM-" } },
        { jobId: { startsWith: "JOBS-TGLI-" } },
        { jobId: { startsWith: "JOBS-HYPN-" } },
        { jobId: { startsWith: "JOBS-AGLH-" } },
        { jobId: { startsWith: "JOBS-WMTP-" } },
        { jobId: { startsWith: "JOBS-DFMT-" } },
        { jobId: { startsWith: "JOBS-HULL-" } },
        { jobId: { startsWith: "JOBS-CHHC-" } },
        { jobId: { startsWith: "JOBS-DWSS-" } },
        { jobId: { startsWith: "JOBS-SCACS-" } },
        { jobId: { startsWith: "JOBS-SVSS-" } },
        { jobId: { startsWith: "JOBS-CSST-" } },
        { jobId: { startsWith: "JOBS-EDMC-" } },
      ],
      activeFlag: true,
    },
  });

  if (kind === "v312") return activeJobs >= 28500;
  if (kind === "v311") return activeJobs >= 13000;
  if (kind === "v310") return activeJobs >= 12000;
  if (kind === "v39") return activeJobs >= 11000;
  if (kind === "v38") return activeJobs >= 9500;
  if (kind === "v37") return activeJobs >= 8200;
  if (kind === "v36") return activeJobs >= 6800;
  if (kind === "v34") return activeJobs >= 4800;
  if (kind === "v33") return activeJobs >= 4500;
  if (kind === "v32") return activeJobs >= 3500;
  if (kind === "v31") return activeJobs >= 2500;
  return activeJobs >= 1000;
}

/** @deprecated Use isEmdrMasterRepositorySeeded. */
export async function isV30MasterRepositorySeeded(): Promise<boolean> {
  return isEmdrMasterRepositorySeeded();
}

export async function seedEmdrMasterRepository() {
  const kind = resolveLoadedEmdrMasterRepositoryKind() ?? resolveEmdrMasterRepositoryKind();
  if (!kind || !isEmdrMasterRepositoryPresent()) {
    throw new Error("EMDR master repository workbook not found in data/emdr/v2/");
  }

  // Retired trees keep rows for audit; release unique mtil_job_code slots for re-seed.
  await prisma.jobLibraryNode.updateMany({
    where: { deletedAt: { not: null }, mtilJobCode: { not: null } },
    data: { mtilJobCode: null },
  });

  const config = getEmdrMasterRepositoryReleaseConfig(kind);
  const parsed = loadEmdrMasterRepositoryParsed();
  if (!parsed) {
    throw new Error("Failed to parse EMDR master repository workbook(s)");
  }
  const mtilValidation = validateMtilWorkbook(parsed);
  const emdrValidation = validateEmdrSprintWorkbook(parsed);

  if (!mtilValidation.valid) {
    throw new Error(`EMDR MTIL validation failed: ${mtilValidation.errors[0]?.message ?? "unknown"}`);
  }
  if (!emdrValidation.valid) {
    throw new Error(`EMDR validation failed: ${emdrValidation.errors[0]?.message ?? "unknown"}`);
  }

  const retiredNodes = await retireSupersededEmdrTrees(config.treeCode);
  const deactivatedJobs = await deactivateSupersededV201Jobs();

  const importResult = await importV30MasterRepositoryFromParsed(parsed);
  if (!importResult.ok) {
    throw new Error(importResult.error ?? "EMDR master repository import failed");
  }

  const tree = buildEmdrMasterRepositoryTree(parsed, config);
  const rootId = await ensureEmdrRootNode(config);

  for (const category of tree.children ?? []) {
    const categoryId = await ensureCategoryNode(rootId, category);
    await mergeChildNodes(categoryId, category.children ?? []);
  }

  const retiredDuplicateNodes = await retireDuplicateStandardJobNodes();
  const linkedNodes = await linkMasterJobsToNodes(config.mtilPhase);

  const meJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-")).length;
  const aeJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-AE-")).length;
  const blrJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-BLR-")).length;
  const pmpJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PMP-")).length;
  const cmpJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-CMP-")).length;
  const purJobs = parsed.masterJobs.filter(
    (j) => j.jobId.startsWith("JOBS-PUR-") || /purifier/i.test(j.machinery),
  ).length;
  const hexJobs = parsed.masterJobs.filter((j) =>
    /heat exchangers, heaters & condensers/i.test(j.machinery),
  ).length;
  const coptJobs = parsed.masterJobs.filter((j) => /cargo oil pump turbine|copt/i.test(j.machinery)).length;
  const dhkJobs = parsed.masterJobs.filter((j) => /deck heating|cargo tank heating|steam coils/i.test(j.machinery)).length;
  const dmwJobs = parsed.masterJobs.filter((j) => /deck masts|rigging/i.test(j.machinery)).length;
  const dlaJobs = parsed.masterJobs.filter((j) => /lifting appliances/i.test(j.machinery)).length;
  const cgpJobs = parsed.masterJobs.filter((j) => /cargo pumping system/i.test(j.machinery)).length;
  const stgJobs = parsed.masterJobs.filter((j) => /steering gear/i.test(j.machinery)).length;
  const dmwWinchJobs = parsed.masterJobs.filter((j) =>
    /windlass|winch|capstan|deck machinery/i.test(j.machinery),
  ).length;
  const lsaDavitsJobs = parsed.masterJobs.filter((j) =>
    /life saving|davit|rescue boat/i.test(j.machinery),
  ).length;
  const fireFightingJobs = parsed.masterJobs.filter((j) => /fire fighting/i.test(j.machinery)).length;
  const inertGasJobs = parsed.masterJobs.filter((j) => /inert gas|\bigg\b|scrubber/i.test(j.machinery)).length;
  const compressedAirJobs = parsed.masterJobs.filter((j) => /compressed air|starting air/i.test(j.machinery)).length;
  const electricalMotorJobs = parsed.masterJobs.filter((j) => /electrical motor/i.test(j.machinery)).length;
  const shipboardPumpJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PUMP-")).length;
  const typewiseHeatExchangerJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-HEX-")).length;
  const typewiseInertGasJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-IGS-")).length;
  const environmentalMachineryJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ENV-")).length;
  const electricalPowerJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-EPD-")).length;
  const typewiseFireLsaSafetyJobs = parsed.masterJobs.filter((j) => isV323TypewiseFfsJobId(j.jobId)).length;
  const propulsionShaftingJobs = parsed.masterJobs.filter((j) => isV324TypewisePropJobId(j.jobId)).length;
  const hvacVentilationJobs = parsed.masterJobs.filter((j) => isV325TypewiseHvacJobId(j.jobId)).length;
  const automationIasJobs = parsed.masterJobs.filter((j) => isV326TypewiseAutoJobId(j.jobId)).length;
  const valvesPipingJobs = parsed.masterJobs.filter((j) => isV327TypewiseVpsoJobId(j.jobId)).length;
  const navigationCommunicationJobs = parsed.masterJobs.filter((j) => isV328TypewiseNavcomJobId(j.jobId)).length;
  const tankGaugingJobs = parsed.masterJobs.filter((j) => isV329TypewiseTgliJobId(j.jobId)).length;
  const hydraulicPneumaticJobs = parsed.masterJobs.filter((j) => isV330TypewiseHypnJobId(j.jobId)).length;
  const accommodationGalleyJobs = parsed.masterJobs.filter((j) => isV331TypewiseAglhJobId(j.jobId)).length;
  const workshopMachineryJobs = parsed.masterJobs.filter((j) => isV332TypewiseWmtpJobId(j.jobId)).length;
  const deckFittingsJobs = parsed.masterJobs.filter((j) => isV333TypewiseDfmtJobId(j.jobId)).length;
  const hullStructureJobs = parsed.masterJobs.filter((j) => isV334TypewiseHullJobId(j.jobId)).length;
  const cargoHoldJobs = parsed.masterJobs.filter((j) => isV335TypewiseChhcJobId(j.jobId)).length;
  const domesticWaterJobs = parsed.masterJobs.filter((j) => isV336TypewiseDwssJobId(j.jobId)).length;
  const securityCctvJobs = parsed.masterJobs.filter((j) => isV337TypewiseScacsJobId(j.jobId)).length;
  const specialVesselJobs = parsed.masterJobs.filter((j) => isV339TypewiseSvssJobId(j.jobId)).length;
  const classStatutoryJobs = parsed.masterJobs.filter((j) => isV340TypewiseCsstJobId(j.jobId)).length;
  const gapClosureEdmcJobs = parsed.masterJobs.filter((j) => isV341TypewiseEdmcJobId(j.jobId)).length;
  const fwgJobs = parsed.masterJobs.filter((j) => /fresh water generator|\bfwg\b/i.test(j.machinery)).length;
  const acJobs = parsed.masterJobs.filter(
    (j) => /air conditioning|\bhvac\b/i.test(j.machinery) && !isV325TypewiseHvacJobId(j.jobId),
  ).length;
  const refJobs = parsed.masterJobs.filter((j) => /refrigeration/i.test(j.machinery)).length;

  return {
    kind,
    release: parsed.release,
    jobCount: parsed.masterJobs.length,
    mainEngineJobCount: meJobs,
    auxiliaryEngineJobCount: aeJobs,
    boilerJobCount: blrJobs,
    pumpJobCount: pmpJobs,
    compressorJobCount: cmpJobs,
    purifierJobCount: purJobs,
    heatExchangerJobCount: hexJobs,
    coptJobCount: coptJobs,
    deckHeatingJobCount: dhkJobs,
    deckMastJobCount: dmwJobs,
    liftingApplianceJobCount: dlaJobs,
    cargoPumpingJobCount: cgpJobs,
    steeringGearJobCount: stgJobs,
    deckMachineryWinchJobCount: dmwWinchJobs,
    lsaDavitsJobCount: lsaDavitsJobs,
    fireFightingJobCount: fireFightingJobs,
    inertGasJobCount: inertGasJobs,
    compressedAirJobCount: compressedAirJobs,
    electricalMotorJobCount: electricalMotorJobs,
    shipboardPumpJobCount: shipboardPumpJobs,
    typewiseHeatExchangerJobCount: typewiseHeatExchangerJobs,
    typewiseInertGasJobCount: typewiseInertGasJobs,
    environmentalMachineryJobCount: environmentalMachineryJobs,
    electricalPowerJobCount: electricalPowerJobs,
    typewiseFireLsaSafetyJobCount: typewiseFireLsaSafetyJobs,
    propulsionShaftingJobCount: propulsionShaftingJobs,
    hvacVentilationJobCount: hvacVentilationJobs,
    automationIasJobCount: automationIasJobs,
    valvesPipingJobCount: valvesPipingJobs,
    navigationCommunicationJobCount: navigationCommunicationJobs,
    tankGaugingJobCount: tankGaugingJobs,
    hydraulicPneumaticJobCount: hydraulicPneumaticJobs,
    accommodationGalleyJobCount: accommodationGalleyJobs,
    workshopMachineryJobCount: workshopMachineryJobs,
    deckFittingsJobCount: deckFittingsJobs,
    hullStructureJobCount: hullStructureJobs,
    cargoHoldJobCount: cargoHoldJobs,
    domesticWaterJobCount: domesticWaterJobs,
    securityCctvJobCount: securityCctvJobs,
    specialVesselJobCount: specialVesselJobs,
    classStatutoryJobCount: classStatutoryJobs,
    gapClosureEdmcJobCount: gapClosureEdmcJobs,
    fwgJobCount: fwgJobs,
    airConditioningJobCount: acJobs,
    refrigerationJobCount: refJobs,
    systemCount: parsed.repositoryIndex.length,
    templateCount: parsed.templates.length,
    measurementCount: parsed.measurements.length,
    checklistItemCount: parsed.checklistItems.length,
    imported: importResult.imported,
    linkedNodes,
    retiredSupersededNodes: retiredNodes,
    retiredDuplicateNodes,
    deactivatedV201Jobs: deactivatedJobs,
    validation: {
      mtilWarnings: mtilValidation.warnings.length,
      emdrWarnings: emdrValidation.warnings.length,
    },
  };
}

/** @deprecated Use seedEmdrMasterRepository. */
export async function seedV30MainEngineRepository() {
  return seedEmdrMasterRepository();
}
