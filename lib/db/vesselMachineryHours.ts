import { prisma } from "@/lib/prisma";

export type VesselMachineryHoursDto = {
  vesselId: string;
  mainEngineRunningHours: number | null;
  auxiliaryEngineRunningHours: number | null;
  boilerRunningHours: number | null;
  mainEngine: string | null;
  auxiliaryEngine: string | null;
  boilerInfo: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function getVesselMachineryHours(
  vesselId: string,
): Promise<VesselMachineryHoursDto> {
  const profile = await prisma.vesselTechnicalProfile.findUnique({
    where: { vesselId },
  });

  return {
    vesselId,
    mainEngineRunningHours: profile?.mainEngineRunningHours ?? null,
    auxiliaryEngineRunningHours: profile?.auxiliaryEngineRunningHours ?? null,
    boilerRunningHours: profile?.boilerRunningHours ?? null,
    mainEngine: profile?.mainEngine ?? null,
    auxiliaryEngine: profile?.auxiliaryEngine ?? null,
    boilerInfo: profile?.boilerInfo ?? null,
    updatedAt: profile?.runningHoursUpdatedAt?.toISOString() ?? null,
    updatedBy: profile?.runningHoursUpdatedBy ?? null,
  };
}

export async function updateVesselMachineryHours(
  vesselId: string,
  input: {
    mainEngineRunningHours?: number | null;
    auxiliaryEngineRunningHours?: number | null;
    boilerRunningHours?: number | null;
    updatedBy: string;
  },
) {
  const data = {
    mainEngineRunningHours: input.mainEngineRunningHours ?? null,
    auxiliaryEngineRunningHours: input.auxiliaryEngineRunningHours ?? null,
    boilerRunningHours: input.boilerRunningHours ?? null,
    runningHoursUpdatedAt: new Date(),
    runningHoursUpdatedBy: input.updatedBy,
  };

  await prisma.vesselTechnicalProfile.upsert({
    where: { vesselId },
    create: { vesselId, ...data },
    update: data,
  });

  return getVesselMachineryHours(vesselId);
}
