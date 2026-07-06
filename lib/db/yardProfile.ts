import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const profileInclude = {
  company: { select: { id: true, code: true, name: true, contactEmail: true, contactPhone: true } },
  docks: { orderBy: { sortOrder: "asc" } },
  facilities: { orderBy: { sortOrder: "asc" } },
  cranes: { orderBy: { sortOrder: "asc" } },
  capacitySlots: { orderBy: [{ year: "asc" }, { month: "asc" }, { slotLabel: "asc" }] },
} satisfies Prisma.YardProfileInclude;

export type YardProfileRecord = Prisma.YardProfileGetPayload<{ include: typeof profileInclude }>;

export async function findDefaultShipyardCompanyId(): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { category: "shipyard", deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return company?.id ?? null;
}

async function seedDefaultInfrastructure(profileId: string) {
  const dock = await prisma.yardDock.create({
    data: {
      yardProfileId: profileId,
      dockNo: "DD-1",
      dockType: "graving_dock",
      maxLoaM: 280,
      maxBeamM: 45,
      maxDraftM: 12,
      liftingCapacityT: 45000,
      sortOrder: 0,
    },
  });

  await prisma.yardDock.create({
    data: {
      yardProfileId: profileId,
      dockNo: "Berth-3",
      dockType: "repair_berth",
      maxLoaM: 200,
      maxBeamM: 32,
      maxDraftM: 10,
      sortOrder: 1,
    },
  });

  await prisma.yardFacility.createMany({
    data: [
      {
        yardProfileId: profileId,
        facilityType: "steel_workshop",
        name: "Steel fabrication shop",
        capabilities: "Hull plate renewal, structural stiffeners, tank repairs",
        sortOrder: 0,
      },
      {
        yardProfileId: profileId,
        facilityType: "painting_blast",
        name: "Blast & paint hall",
        capabilities: "SA 2.5 blasting, epoxy systems, antifouling",
        sortOrder: 1,
      },
    ],
  });

  await prisma.yardCrane.createMany({
    data: [
      {
        yardProfileId: profileId,
        name: "Gantry crane #1",
        capacityT: 100,
        radiusM: 45,
        location: "Dry dock head",
        sortOrder: 0,
      },
      {
        yardProfileId: profileId,
        name: "Mobile crane #2",
        capacityT: 50,
        radiusM: 30,
        location: "Berth apron",
        sortOrder: 1,
      },
    ],
  });

  const year = new Date().getFullYear();
  const slots = ["DD-1", "Berth-3"];
  for (const slotLabel of slots) {
    for (let month = 1; month <= 12; month++) {
      const occupancyPct = slotLabel === "DD-1" && month >= 3 && month <= 5 ? 85 : month % 4 === 0 ? 60 : 25;
      await prisma.yardCapacitySlot.create({
        data: {
          yardProfileId: profileId,
          dockId: slotLabel === "DD-1" ? dock.id : null,
          slotLabel,
          year,
          month,
          occupancyPct,
        },
      });
    }
  }
}

/** Resolve yard profile for portal — creates shell record for first shipyard company if missing. */
export async function getOrCreateYardProfile(companyId?: string | null): Promise<YardProfileRecord | null> {
  const resolvedCompanyId = companyId ?? (await findDefaultShipyardCompanyId());
  if (!resolvedCompanyId) return null;

  let profile = await prisma.yardProfile.findUnique({
    where: { companyId: resolvedCompanyId },
    include: profileInclude,
  });

  if (!profile) {
    const company = await prisma.company.findUnique({
      where: { id: resolvedCompanyId },
      select: { address: true },
    });
    profile = await prisma.yardProfile.create({
      data: {
        companyId: resolvedCompanyId,
        address: company?.address ?? null,
        dockTypes: ["graving_dock", "repair_berth"],
        repairBerths: 2,
      },
      include: profileInclude,
    });
  }

  if (profile.docks.length === 0) {
    await seedDefaultInfrastructure(profile.id);
    profile = await prisma.yardProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: profileInclude,
    });
  }

  return profile;
}

export type YardProfilePatchInput = {
  logoUrl?: string | null;
  country?: string | null;
  port?: string | null;
  address?: string | null;
  website?: string | null;
  establishedYear?: number | null;
  repairBerths?: number | null;
  totalEmployees?: number | null;
  dockTypes?: string[];
  docks?: {
    id?: string;
    dockNo: string;
    dockType: string;
    maxLoaM?: number | null;
    maxBeamM?: number | null;
    maxDraftM?: number | null;
    liftingCapacityT?: number | null;
    sortOrder?: number;
  }[];
  facilities?: {
    id?: string;
    facilityType: string;
    name: string;
    capabilities?: string | null;
    sortOrder?: number;
  }[];
  cranes?: {
    id?: string;
    name: string;
    capacityT?: number | null;
    radiusM?: number | null;
    location?: string | null;
    available?: boolean;
    certificationExpiry?: string | null;
    sortOrder?: number;
  }[];
  capacitySlots?: {
    slotLabel: string;
    year: number;
    month: number;
    occupancyPct: number;
    dockId?: string | null;
  }[];
};

export async function updateYardProfile(
  companyId: string | null | undefined,
  input: YardProfilePatchInput,
): Promise<YardProfileRecord | null> {
  const profile = await getOrCreateYardProfile(companyId);
  if (!profile) return null;

  await prisma.$transaction(async (tx) => {
    const scalarData: Prisma.YardProfileUpdateInput = {};
    if (input.logoUrl !== undefined) scalarData.logoUrl = input.logoUrl;
    if (input.country !== undefined) scalarData.country = input.country;
    if (input.port !== undefined) scalarData.port = input.port;
    if (input.address !== undefined) scalarData.address = input.address;
    if (input.website !== undefined) scalarData.website = input.website;
    if (input.establishedYear !== undefined) scalarData.establishedYear = input.establishedYear;
    if (input.repairBerths !== undefined) scalarData.repairBerths = input.repairBerths;
    if (input.totalEmployees !== undefined) scalarData.totalEmployees = input.totalEmployees;
    if (input.dockTypes !== undefined) scalarData.dockTypes = input.dockTypes;

    if (Object.keys(scalarData).length > 0) {
      await tx.yardProfile.update({
        where: { id: profile.id },
        data: scalarData,
      });
    }

    if (input.docks) {
      const keepIds = input.docks.map((d) => d.id).filter(Boolean) as string[];
      await tx.yardDock.deleteMany({
        where: { yardProfileId: profile.id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
      });
      for (const [i, dock] of input.docks.entries()) {
        if (dock.id) {
          await tx.yardDock.update({
            where: { id: dock.id },
            data: {
              dockNo: dock.dockNo,
              dockType: dock.dockType,
              maxLoaM: dock.maxLoaM,
              maxBeamM: dock.maxBeamM,
              maxDraftM: dock.maxDraftM,
              liftingCapacityT: dock.liftingCapacityT,
              sortOrder: dock.sortOrder ?? i,
            },
          });
        } else {
          await tx.yardDock.create({
            data: {
              yardProfileId: profile.id,
              dockNo: dock.dockNo,
              dockType: dock.dockType,
              maxLoaM: dock.maxLoaM,
              maxBeamM: dock.maxBeamM,
              maxDraftM: dock.maxDraftM,
              liftingCapacityT: dock.liftingCapacityT,
              sortOrder: dock.sortOrder ?? i,
            },
          });
        }
      }
    }

    if (input.facilities) {
      const keepIds = input.facilities.map((f) => f.id).filter(Boolean) as string[];
      await tx.yardFacility.deleteMany({
        where: { yardProfileId: profile.id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
      });
      for (const [i, facility] of input.facilities.entries()) {
        if (facility.id) {
          await tx.yardFacility.update({
            where: { id: facility.id },
            data: {
              facilityType: facility.facilityType,
              name: facility.name,
              capabilities: facility.capabilities,
              sortOrder: facility.sortOrder ?? i,
            },
          });
        } else {
          await tx.yardFacility.create({
            data: {
              yardProfileId: profile.id,
              facilityType: facility.facilityType,
              name: facility.name,
              capabilities: facility.capabilities,
              sortOrder: facility.sortOrder ?? i,
            },
          });
        }
      }
    }

    if (input.cranes) {
      const keepIds = input.cranes.map((c) => c.id).filter(Boolean) as string[];
      await tx.yardCrane.deleteMany({
        where: { yardProfileId: profile.id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
      });
      for (const [i, crane] of input.cranes.entries()) {
        if (crane.id) {
          await tx.yardCrane.update({
            where: { id: crane.id },
            data: {
              name: crane.name,
              capacityT: crane.capacityT,
              radiusM: crane.radiusM,
              location: crane.location,
              available: crane.available ?? true,
              certificationExpiry: crane.certificationExpiry
                ? new Date(crane.certificationExpiry)
                : null,
              sortOrder: crane.sortOrder ?? i,
            },
          });
        } else {
          await tx.yardCrane.create({
            data: {
              yardProfileId: profile.id,
              name: crane.name,
              capacityT: crane.capacityT,
              radiusM: crane.radiusM,
              location: crane.location,
              available: crane.available ?? true,
              certificationExpiry: crane.certificationExpiry
                ? new Date(crane.certificationExpiry)
                : null,
              sortOrder: crane.sortOrder ?? i,
            },
          });
        }
      }
    }

    if (input.capacitySlots) {
      for (const slot of input.capacitySlots) {
        await tx.yardCapacitySlot.upsert({
          where: {
            yardProfileId_slotLabel_year_month: {
              yardProfileId: profile.id,
              slotLabel: slot.slotLabel,
              year: slot.year,
              month: slot.month,
            },
          },
          create: {
            yardProfileId: profile.id,
            slotLabel: slot.slotLabel,
            year: slot.year,
            month: slot.month,
            occupancyPct: slot.occupancyPct,
            dockId: slot.dockId ?? null,
          },
          update: {
            occupancyPct: slot.occupancyPct,
            dockId: slot.dockId ?? null,
          },
        });
      }
    }
  });

  return getOrCreateYardProfile(profile.companyId);
}
