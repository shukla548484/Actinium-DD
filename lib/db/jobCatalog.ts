import type { JobCatalogListType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ListSeed = {
  listType: JobCatalogListType;
  values: string[];
};

const CATALOG_LIST_SEEDS: ListSeed[] = [
  {
    listType: "project_types",
    values: [
      "Special Survey",
      "Damage Repair",
      "Intermediate Survey",
      "Occasional Repair",
      "Underwater Survey",
      "New Installation",
      "Emergency Docking",
      "Lay-up/Reactivation",
      "Conversion/Modification",
      "Warranty Repair",
    ],
  },
  {
    listType: "vessel_types",
    values: [
      "Oil Tanker",
      "Chemical Tanker",
      "LNG Carrier",
      "LPG Carrier",
      "Bulk Carrier",
      "Container Ship",
      "General Cargo",
      "Ro-Ro",
      "Offshore",
      "Passenger",
    ],
  },
  {
    listType: "departments",
    values: ["Engine", "Deck", "Electrical", "Hull", "Safety", "Cargo", "Accommodation"],
  },
  {
    listType: "workshops",
    values: ["Machinery", "Pipe", "Steel", "Hull", "Paint", "Electrical", "Deck", "Safety", "QA/QC"],
  },
  {
    listType: "risk_levels",
    values: ["Low", "Medium", "High", "Critical"],
  },
  {
    listType: "attachment_types",
    values: ["Photo", "Report", "Certificate", "Drawing", "Video", "Manual"],
  },
  {
    listType: "job_statuses",
    values: [
      "Draft",
      "Submitted",
      "Reviewed",
      "Approved",
      "RFQ",
      "Awarded",
      "In Progress",
      "Completed",
      "Closed",
      "Cancelled",
    ],
  },
  {
    listType: "user_roles",
    values: [
      "Chief Engineer",
      "Master",
      "Technical Superintendent",
      "Shipyard Project Manager",
      "Workshop Supervisor",
      "Class Surveyor",
      "Owner Representative",
    ],
  },
];

/** Idempotent seed for Lists sheet (8 enum list types). */
export async function seedJobCatalogLists() {
  let count = 0;
  for (const list of CATALOG_LIST_SEEDS) {
    for (let i = 0; i < list.values.length; i++) {
      const value = list.values[i]!;
      await prisma.jobCatalogListItem.upsert({
        where: { listType_value: { listType: list.listType, value } },
        create: {
          listType: list.listType,
          value,
          label: value,
          sortOrder: i + 1,
          isActive: true,
        },
        update: { label: value, sortOrder: i + 1, isActive: true },
      });
      count += 1;
    }
  }
  return { listTypes: CATALOG_LIST_SEEDS.length, items: count };
}
