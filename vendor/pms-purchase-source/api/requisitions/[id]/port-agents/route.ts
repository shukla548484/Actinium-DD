import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { assertRequisitionViewAccess } from "@/lib/requisition-port-agent-access";
import { RequisitionPortAgentRole } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const agentSelect = {
  id: true,
  requisitionId: true,
  role: true,
  portId: true,
  portName: true,
  agentName: true,
  companyName: true,
  contactPerson: true,
  email: true,
  phone: true,
  fax: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

function parseRole(value: unknown): RequisitionPortAgentRole | null {
  if (
    value === "CURRENT" ||
    value === "OWNERS_CHARTERS" ||
    value === "PAST"
  ) {
    return value;
  }
  return null;
}

/**
 * GET /api/requisitions/[id]/port-agents
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await assertRequisitionViewAccess(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const agents = await prisma.requisitionPortAgent.findMany({
      where: { requisitionId: id },
      select: agentSelect,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error fetching requisition port agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch port agents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requisitions/[id]/port-agents
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const access = await assertRequisitionViewAccess(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const role = parseRole(body.role);
    const portName = typeof body.portName === "string" ? body.portName.trim() : "";
    const agentName = typeof body.agentName === "string" ? body.agentName.trim() : "";

    if (!role) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
    }
    if (!portName) {
      return NextResponse.json({ error: "Port name is required" }, { status: 400 });
    }
    if (!agentName) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    const portId =
      typeof body.portId === "string" && body.portId.trim().length > 0
        ? body.portId.trim()
        : null;

    const agent = await prisma.requisitionPortAgent.create({
      data: {
        requisitionId: id,
        role,
        portId,
        portName,
        agentName,
        companyName:
          typeof body.companyName === "string" ? body.companyName.trim() || null : null,
        contactPerson:
          typeof body.contactPerson === "string" ? body.contactPerson.trim() || null : null,
        email: typeof body.email === "string" ? body.email.trim() || null : null,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
        fax: typeof body.fax === "string" ? body.fax.trim() || null : null,
        address: typeof body.address === "string" ? body.address.trim() || null : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        createdById: currentUser.id,
      },
      select: agentSelect,
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("Error creating requisition port agent:", error);
    return NextResponse.json(
      { error: "Failed to create port agent" },
      { status: 500 }
    );
  }
}
