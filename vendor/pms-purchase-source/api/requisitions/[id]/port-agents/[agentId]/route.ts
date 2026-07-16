import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { assertRequisitionViewAccess } from "@/lib/requisition-port-agent-access";
import { RequisitionPortAgentRole } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string; agentId: string }>;
}

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
 * PUT /api/requisitions/[id]/port-agents/[agentId]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, agentId } = await context.params;
    const access = await assertRequisitionViewAccess(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await prisma.requisitionPortAgent.findFirst({
      where: { id: agentId, requisitionId: id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {
      updatedById: currentUser.id,
    };

    const role = parseRole(body.role);
    if (body.role !== undefined) {
      if (!role) {
        return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
      }
      data.role = role;
    }
    if (typeof body.portName === "string") {
      const portName = body.portName.trim();
      if (!portName) {
        return NextResponse.json({ error: "Port name is required" }, { status: 400 });
      }
      data.portName = portName;
    }
    if (typeof body.agentName === "string") {
      const agentName = body.agentName.trim();
      if (!agentName) {
        return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
      }
      data.agentName = agentName;
    }
    if (body.portId !== undefined) {
      data.portId =
        typeof body.portId === "string" && body.portId.trim().length > 0
          ? body.portId.trim()
          : null;
    }
    for (const field of [
      "companyName",
      "contactPerson",
      "email",
      "phone",
      "fax",
      "address",
      "notes",
    ] as const) {
      if (body[field] !== undefined) {
        data[field] =
          typeof body[field] === "string" ? body[field].trim() || null : null;
      }
    }

    const agent = await prisma.requisitionPortAgent.update({
      where: { id: agentId },
      data,
      select: {
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
          select: { id: true, firstName: true, lastName: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("Error updating requisition port agent:", error);
    return NextResponse.json(
      { error: "Failed to update port agent" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requisitions/[id]/port-agents/[agentId]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id, agentId } = await context.params;
    const access = await assertRequisitionViewAccess(request, id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await prisma.requisitionPortAgent.findFirst({
      where: { id: agentId, requisitionId: id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await prisma.requisitionPortAgent.delete({ where: { id: agentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting requisition port agent:", error);
    return NextResponse.json(
      { error: "Failed to delete port agent" },
      { status: 500 }
    );
  }
}
