/**
 * Chat Message Search API
 * GET /api/purchase-orders/[id]/chat/search
 * Search messages by text, date, sender, attachments
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (![32, 33, 50, 99, 100].includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const senderType = searchParams.get("senderType");
    const hasAttachments = searchParams.get("hasAttachments") === "true";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {
      purchaseOrderId: id,
      isDeleted: false,
    };

    // Text search
    if (query) {
      where.message = {
        contains: query,
        mode: "insensitive",
      };
    }

    // Filter by sender type
    if (senderType) {
      where.senderType = senderType;
    }

    // Filter by attachments
    if (hasAttachments) {
      where.attachments = {
        some: {},
      };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const messages = await prisma.vendorChatMessage.findMany({
      where,
      select: {
        id: true,
        purchaseOrderId: true,
        vendorId: true,
        senderType: true,
        senderId: true,
        message: true,
        isRead: true,
        readAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        attachments: {
          select: {
            id: true,
            messageId: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Serialize BigInt
    const serializedMessages = messages.map((msg: any) => ({
      ...msg,
      attachments: (msg.attachments || []).map((att: any) => ({
        ...att,
        fileSize: att.fileSize ? (typeof att.fileSize === 'bigint' ? att.fileSize.toString() : att.fileSize) : null,
      })),
    }));

    return NextResponse.json({
      success: true,
      messages: serializedMessages,
      count: serializedMessages.length,
    });
  } catch (error: any) {
    console.error("Error searching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to search messages" },
      { status: 500 }
    );
  }
}



