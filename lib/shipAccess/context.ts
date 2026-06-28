import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";
import {
  getSelectedShipVesselId,
  getShipAccessVesselIds,
  listShipAccessVessels,
  type ShipAccessVessel,
} from "@/lib/shipAccess/scope";

export type ShipAccessContext = {
  vessels: ShipAccessVessel[];
  vesselId: string | null;
  vessel: ShipAccessVessel | null;
  dryDockProject: {
    id: string;
    name: string;
    referenceCode: string | null;
    status: string;
  } | null;
  scoped: boolean;
};

export async function getShipAccessContext(): Promise<ShipAccessContext> {
  const vessels = await listShipAccessVessels();
  const allowedIds = await getShipAccessVesselIds();
  const vesselId = await getSelectedShipVesselId();
  const vessel = vessels.find((v) => v.id === vesselId) ?? null;

  let dryDockProject: ShipAccessContext["dryDockProject"] = null;
  if (vesselId) {
    const project = await prisma.dryDockProject.findFirst({
      where: {
        vesselId,
        ...notDeleted,
        status: { notIn: ["closed", "cancelled"] },
      },
      orderBy: [{ plannedStart: "desc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, referenceCode: true, status: true },
    });
    if (project) {
      dryDockProject = {
        id: project.id,
        name: project.name,
        referenceCode: project.referenceCode,
        status: project.status,
      };
    }
  }

  return {
    vessels,
    vesselId,
    vessel,
    dryDockProject,
    scoped: allowedIds.length > 0 && vessels.length <= allowedIds.length,
  };
}
