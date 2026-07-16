import type { KnowledgePackAssetType } from "@prisma/client";

export type KnowledgeQualityInput = {
  assets: Array<{ assetType: KnowledgePackAssetType }>;
  facts: Array<{ label: string; value: string }>;
  hasDrawingNumber: boolean;
  hasPartNumber: boolean;
  hasSummary: boolean;
};

const CHECKLIST: Array<{
  key: string;
  label: string;
  weight: number;
  check: (input: KnowledgeQualityInput) => boolean;
}> = [
  {
    key: "partNumber",
    label: "Part number",
    weight: 10,
    check: (i) => i.hasPartNumber,
  },
  {
    key: "drawing",
    label: "Drawing reference",
    weight: 10,
    check: (i) => i.hasDrawingNumber,
  },
  {
    key: "summary",
    label: "Summary text",
    weight: 10,
    check: (i) => i.hasSummary,
  },
  {
    key: "drawingFile",
    label: "Drawing file",
    weight: 15,
    check: (i) => i.assets.some((a) => a.assetType === "DRAWING"),
  },
  {
    key: "manual",
    label: "Manual / OEM bulletin",
    weight: 15,
    check: (i) =>
      i.assets.some((a) => a.assetType === "MANUAL" || a.assetType === "OEM_BULLETIN"),
  },
  {
    key: "photo",
    label: "Photo",
    weight: 10,
    check: (i) => i.assets.some((a) => a.assetType === "PHOTO"),
  },
  {
    key: "spec",
    label: "Specification sheet",
    weight: 10,
    check: (i) => i.assets.some((a) => a.assetType === "SPEC_SHEET"),
  },
  {
    key: "qa",
    label: "Q&A / clarification facts",
    weight: 10,
    check: (i) =>
      i.assets.some((a) => a.assetType === "QA_THREAD") || i.facts.length > 0,
  },
  {
    key: "dimensions",
    label: "Dimensions / material facts",
    weight: 10,
    check: (i) =>
      i.facts.some((f) =>
        /dimension|material|coating|weight|temperature|pressure/i.test(
          `${f.label} ${f.value}`
        )
      ),
  },
];

export function computeKnowledgePackQualityScore(input: KnowledgeQualityInput): {
  scorePercent: number;
  missing: string[];
} {
  let earned = 0;
  const total = CHECKLIST.reduce((s, c) => s + c.weight, 0);
  const missing: string[] = [];
  for (const item of CHECKLIST) {
    if (item.check(input)) {
      earned += item.weight;
    } else {
      missing.push(item.label);
    }
  }
  return {
    scorePercent: total > 0 ? Math.round((earned / total) * 100) : 0,
    missing,
  };
}

export function slugifyKnowledgePackTitle(title: string, partNumber?: string | null) {
  const base = (partNumber || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base || "pack"}-${suffix}`;
}
