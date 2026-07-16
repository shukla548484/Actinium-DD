import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { secureApiRoute, SecureRequestContext } from "@/lib/api-security";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// POST /api/purchase-orders/[id]/delivery-charges - Update delivery charges manually
const postHandler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id: string } | Promise<{ id: string }>
) => {
  const resolvedParams = params instanceof Promise ? await params : params;
  if (!resolvedParams?.id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }
  const { id } = resolvedParams;

  const allowedLevels = [32, 33, 50, 99, 100];
  const lvl = context.user?.designationAccessLevel;
  if (!context.user || (!allowedLevels.includes(lvl ?? 0) && !isAdminEquivalentAccessLevel(lvl))) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  const CHARGE_KEYS = [
    "deliveryCharges",
    "courierCharges",
    "handlingCharges",
    "transportCharges",
    "customClearanceCharges",
    "warehouseCharges",
  ] as const;
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const key of CHARGE_KEYS) {
    const val = formData.get(key) as string | null;
    const num = val ? parseFloat(val) : 0;
    if (!Number.isNaN(num) && num > 0) {
      breakdown[key] = num;
      total += num;
    }
  }
  const deliveryChargesTotal = formData.get("deliveryCharges") as string | null;
  const totalFromClient = deliveryChargesTotal ? parseFloat(deliveryChargesTotal) : total;
  const finalTotal = Number.isNaN(totalFromClient) ? total : totalFromClient;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      quote: true,
    },
  });

  if (!po) {
    return NextResponse.json(
      { error: "Purchase Order not found" },
      { status: 404 }
    );
  }

  if (!po.quoteId) {
    return NextResponse.json(
      { error: "No linked quote found for this PO" },
      { status: 400 }
    );
  }

  let attachmentPath = po.quote.deliveryChargesAttachment;
  if (file) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "public", "uploads", "vendor-quotes");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    const timestamp = Date.now();
    const filename = `manual-delivery-${po.requisitionId}-${timestamp}-${file.name}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);
    attachmentPath = `/uploads/vendor-quotes/${filename}`;
  }

  await prisma.vendorQuote.update({
    where: { id: po.quoteId },
    data: {
      deliveryCharges: finalTotal > 0 ? finalTotal : null,
      otherChargesBreakdown: Object.keys(breakdown).length > 0 ? breakdown : null,
      deliveryChargesAttachment: attachmentPath,
    },
  });

  return NextResponse.json({
    message: "Delivery charges updated successfully",
  });
};

export const POST = secureApiRoute(postHandler);
