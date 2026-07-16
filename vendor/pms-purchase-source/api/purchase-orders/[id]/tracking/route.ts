import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { secureApiRoute, SecureRequestContext, validateUUID, validateCompanyAccess } from "@/lib/api-security";
import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { isValidOrderReadiness } from "@/lib/order-readiness";

function canEditOrderTrackingAsPurchaser(level: number | null | undefined): boolean {
  return level === 32 || level === 33 || isAdminEquivalentAccessLevel(level);
}

function parseDateInput(v: unknown): Date | null {
  if (v === undefined) return null;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const putHandler = async (
  request: NextRequest,
  context: SecureRequestContext,
  routeParams?: { id: string }
) => {
  try {
    const resolved = routeParams;
    if (!resolved?.id) {
      return NextResponse.json({ error: "Purchase order ID is required" }, { status: 400 });
    }

    const id = validateUUID(resolved.id, "Purchase Order ID");
    if (!id) {
      return NextResponse.json({ error: "Invalid purchase order ID" }, { status: 400 });
    }

    const level = context.user.designationAccessLevel ?? 0;
    if (!canEditOrderTrackingAsPurchaser(level)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Order tracking can only be updated by purchasers with access level 32 or 33 (or administrators)." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    const orderReadinessRaw = body.orderReadiness;
    const orderReadiness =
      typeof orderReadinessRaw === "string" && orderReadinessRaw.length > 0 ? orderReadinessRaw : "NOT_READY";
    if (!isValidOrderReadiness(orderReadiness)) {
      return NextResponse.json({ error: "Invalid order readiness status" }, { status: 400 });
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: { select: { companyId: true } },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const companyId = purchaseOrder.requisition?.vessel?.companyId;
    if (companyId) {
      const ok = await validateCompanyAccess(context, companyId, id);
      if (!ok) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v || null : null);

    const createData = {
      purchaseOrderId: id,
      orderReadiness,
      readinessDate: "readinessDate" in body ? parseDateInput(body.readinessDate) : null,
      dispatchedDate: "dispatchedDate" in body ? parseDateInput(body.dispatchedDate) : null,
      awb: "awb" in body ? strOrNull(body.awb) : null,
      transportCompanyName: "transportCompanyName" in body ? strOrNull(body.transportCompanyName) : null,
      expectedDeliveryDate: "expectedDeliveryDate" in body ? parseDateInput(body.expectedDeliveryDate) : null,
      expectedDeliveryDateToAgent:
        "expectedDeliveryDateToAgent" in body ? parseDateInput(body.expectedDeliveryDateToAgent) : null,
      actualDeliveryDate: "actualDeliveryDate" in body ? parseDateInput(body.actualDeliveryDate) : null,
      trackingNotes: "trackingNotes" in body ? strOrNull(body.trackingNotes) : null,
    };

    const updateData: Prisma.OrderTrackingUpdateInput = { orderReadiness };
    if ("readinessDate" in body) updateData.readinessDate = parseDateInput(body.readinessDate);
    if ("dispatchedDate" in body) updateData.dispatchedDate = parseDateInput(body.dispatchedDate);
    if ("awb" in body) updateData.awb = strOrNull(body.awb);
    if ("transportCompanyName" in body) updateData.transportCompanyName = strOrNull(body.transportCompanyName);
    if ("expectedDeliveryDate" in body) updateData.expectedDeliveryDate = parseDateInput(body.expectedDeliveryDate);
    if ("expectedDeliveryDateToAgent" in body) {
      updateData.expectedDeliveryDateToAgent = parseDateInput(body.expectedDeliveryDateToAgent);
    }
    if ("actualDeliveryDate" in body) updateData.actualDeliveryDate = parseDateInput(body.actualDeliveryDate);
    if ("trackingNotes" in body) updateData.trackingNotes = strOrNull(body.trackingNotes);

    const orderTracking = await prisma.orderTracking.upsert({
      where: { purchaseOrderId: id },
      create: createData,
      update: updateData,
    });

    return NextResponse.json({ success: true, orderTracking });
  } catch (error) {
    console.error("[purchase-orders tracking PUT]", error);
    return NextResponse.json({ error: "Failed to update order tracking" }, { status: 500 });
  }
};

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeParams = await context.params;
  return secureApiRoute(
    (req, ctx) => putHandler(req, ctx, routeParams),
    { requireAuth: true, allowedMethods: ["PUT"], minAccessLevel: 10 }
  )(request, { params: routeParams });
}
