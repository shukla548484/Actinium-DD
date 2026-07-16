import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { broadcastChatMessage } from "@/lib/pusher-server";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  canUploadPurchaseInvoice,
  isInvoiceVerifierAccessLevel,
} from "@/lib/purchase/invoice-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/purchase-orders/[id]/chat - Get chat messages (purchaser side)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      console.warn('[CHAT GET] Authentication failed - user not found');
      return NextResponse.json(
        { error: "Unauthorized", message: "Please refresh the page to re-authenticate" },
        { status: 401 }
      );
    }

    // Check access level (32, 33, or admin-equivalent 50/99/100)
    // Admin-equivalent users can access and see chats of all users and vendors
    const userAccessLevel = currentUser.designationAccessLevel || 0;
    console.log(`[CHAT GET] User authenticated: ${currentUser.id}, Access Level: ${userAccessLevel}`);
    
    const canAccessChat =
      canUploadPurchaseInvoice(userAccessLevel) ||
      isInvoiceVerifierAccessLevel(userAccessLevel);
    if (!canAccessChat && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      console.warn(`[CHAT GET] Access denied - User level ${userAccessLevel}`);
      return NextResponse.json(
        { 
          error: "Insufficient permissions",
          message: `Access level ${userAccessLevel} is not authorized for PO platform messages.`,
          userAccessLevel,
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    // Build query - optimized for performance
    // Admin-equivalent users can see all chats of all users and vendors
    // Other users (32, 33) see all messages in their PO chats (both purchaser and vendor messages)
    const where: any = {
      purchaseOrderId: id,
    };
    
    // Note: We don't filter by vendorId or senderId here because:
    // - Purchasers need to see both their messages and vendor messages in the same PO chat
    // - Admin-equivalent users can see all chats regardless of vendor or sender
    // - The PO access control (checked elsewhere) ensures users can only access POs they're authorized for

    if (before) {
      where.id = { lt: before };
    }

    // Verify purchase order exists first
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Fetch messages with optimized query - select only needed fields
    // IMPORTANT: We fetch ALL messages for this PO regardless of senderType (PURCHASER or VENDOR)
    // Use try-catch around Prisma query to handle potential database errors
    let messages: any[] = [];
    try {
      messages = await prisma.vendorChatMessage.findMany({
        where: {
          ...where,
          isDeleted: false, // Exclude deleted messages
        },
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
          deliveredAt: true,
          editedAt: true,
          isPinned: true,
          pinnedAt: true,
          replyToMessageId: true,
          quickReplyId: true,
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
          replyToMessage: {
            select: {
              id: true,
              message: true,
              senderType: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { isPinned: "desc" }, // Pinned messages first
          { createdAt: "asc" }, // Then by creation time
        ],
        take: limit,
      });
      
      // Debug: Log message breakdown
      const purchaserMsgs = messages.filter((m: any) => m.senderType === "PURCHASER");
      const vendorMsgs = messages.filter((m: any) => m.senderType === "VENDOR");
      console.log(`[CHAT GET] Query result - Total: ${messages.length}, Purchaser: ${purchaserMsgs.length}, Vendor: ${vendorMsgs.length}`);
      if (vendorMsgs.length > 0) {
        console.log(`[CHAT GET] Sample vendor messages:`, vendorMsgs.slice(0, 3).map((m: any) => ({
          id: m.id,
          senderType: m.senderType,
          message: m.message.substring(0, 30),
          vendorId: m.vendorId,
        })));
      }
    } catch (prismaError: any) {
      console.error("Prisma query error:", {
        message: prismaError.message,
        code: prismaError.code,
        meta: prismaError.meta,
        stack: prismaError.stack,
      });
      
      // If table doesn't exist or connection fails, return empty array instead of error
      // This prevents 500 errors and allows the UI to work
      if (
        prismaError.code === "P2021" || 
        prismaError.code === "P1001" ||
        prismaError.message?.includes("does not exist") ||
        prismaError.message?.includes("relation") ||
        prismaError.message?.includes("table")
      ) {
        console.warn("Chat table/connection issue - returning empty messages array");
        messages = []; // Return empty array, don't throw error
      } else {
        // Re-throw other errors (syntax errors, etc.)
        throw new Error(
          `Database query failed: ${prismaError.message || "Unknown error"}. ` +
          `Code: ${prismaError.code || "N/A"}. ` +
          `Please check database connection and table existence.`
        );
      }
    }

    // Mark purchaser's unread messages as read (non-blocking - don't wait for it)
    prisma.vendorChatMessage.updateMany({
      where: {
        purchaseOrderId: id,
        senderType: "VENDOR",
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    }).catch((error) => {
      // Log but don't block response
      console.error("Error marking messages as read:", error);
    });

    // Return messages - always return success: true even if empty
    // Ensure messages is always an array
    const messagesArray = Array.isArray(messages) ? messages : [];
    
    // Debug logging to check message types
    const purchaserCount = messagesArray.filter((m: any) => m.senderType === "PURCHASER").length;
    const vendorCount = messagesArray.filter((m: any) => m.senderType === "VENDOR").length;
    console.log(`[CHAT GET] PO ${id}: Total messages: ${messagesArray.length}, Purchaser: ${purchaserCount}, Vendor: ${vendorCount}`);
    
    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = messagesArray.map((msg: any) => ({
      ...msg,
      attachments: (msg.attachments || []).map((att: any) => ({
        ...att,
        fileSize: att.fileSize ? (typeof att.fileSize === 'bigint' ? att.fileSize.toString() : att.fileSize) : null,
      })),
    }));
    
    return NextResponse.json({
      success: true,
      messages: serializedMessages,
    });
  } catch (error: any) {
    console.error("Error fetching chat messages:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Provide more detailed error information
    let errorMessage = "Failed to fetch chat messages";
    const errorDetails: any = {};
    
    if (error?.code) {
      errorDetails.code = error.code;
    }
    if (error?.meta) {
      errorDetails.meta = error.meta;
    }
    if (error?.message) {
      errorDetails.message = error.message;
      errorMessage = error.message;
    }
    
    // Check for specific Prisma errors
    if (error?.code === "P2021" || error?.code === "P2025") {
      errorMessage = "Chat table does not exist. Please run database migrations.";
    } else if (error?.code === "P2002") {
      errorMessage = "Database constraint violation";
    } else if (error?.code === "P2003") {
      errorMessage = "Foreign key constraint violation";
    } else if (error?.code === "P2010") {
      errorMessage = "Raw query error - database connection issue";
    } else if (error?.message?.includes("does not exist")) {
      errorMessage = "Database table or column does not exist. Please run migrations.";
    } else if (error?.message?.includes("relation") && error?.message?.includes("does not exist")) {
      errorMessage = "Database table does not exist. Please run migrations.";
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders/[id]/chat - Send chat message (purchaser side)
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      console.warn('[CHAT POST] Authentication failed - user not found');
      return NextResponse.json(
        { error: "Unauthorized", message: "Please refresh the page to re-authenticate" },
        { status: 401 }
      );
    }

    // Check access level (32, 33, or admin-equivalent 50/99/100)
    const userAccessLevel = currentUser.designationAccessLevel || 0;
    console.log(`[CHAT POST] User authenticated: ${currentUser.id}, Access Level: ${userAccessLevel}`);
    
    const canAccessChat =
      canUploadPurchaseInvoice(userAccessLevel) ||
      isInvoiceVerifierAccessLevel(userAccessLevel);
    if (!canAccessChat && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      console.warn(`[CHAT POST] Access denied - User level ${userAccessLevel}`);
      return NextResponse.json(
        { 
          error: "Insufficient permissions",
          message: `Access level ${userAccessLevel} is not authorized for PO platform messages.`,
          userAccessLevel,
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Verify PO exists
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        quote: {
          include: {
            vendor: true,
          },
        },
        requisition: {
          include: {
            vessel: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const message = (formData.get("message") as string) || "";
    const files = formData.getAll("files") as File[];
    const quickReplyId = formData.get("quickReplyId") as string | null;
    const replyToMessageId = formData.get("replyToMessageId") as string | null;

    // Allow sending messages with either text or files (or both)
    if (!message.trim() && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: "Message text or file attachment is required" },
        { status: 400 }
      );
    }

    // Create chat message with status tracking
    const chatMessage = await prisma.vendorChatMessage.create({
      data: {
        purchaseOrderId: id,
        vendorId: po.quote.vendorId,
        senderType: "PURCHASER",
        senderId: currentUser.id,
        message: message.trim() || "(attachment)",
        status: "SENT", // Message is sent immediately
        quickReplyId: quickReplyId || null,
        replyToMessageId: replyToMessageId || null,
      },
    });

    // Handle file attachments
    const attachments = [];
    if (files && files.length > 0) {
      const gcs = getGoogleCloudStorageService();
      
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileName = `chat_${po.poNumber}_${timestamp}_${sanitizedFileName}`;

        try {
          const uploadResult = await gcs.uploadFile(
            fileBuffer,
            fileName,
            file.type,
            {
              vesselId: po.requisition.vesselId,
              category: "purchase",
              subfolder: `vendor-chat/${po.id}/${chatMessage.id}`,
            }
          );

          const attachment = await prisma.vendorChatAttachment.create({
            data: {
              messageId: chatMessage.id,
              fileName: file.name,
              fileUrl: uploadResult.fileUrl,
              fileType: file.type,
              fileSize: BigInt(file.size),
            },
          });

          attachments.push(attachment);
        } catch (uploadError) {
          console.error("Error uploading attachment:", uploadError);
        }
      }
    }

    // Fetch the complete message with attachments for broadcasting
    const messageWithAttachments = await prisma.vendorChatMessage.findUnique({
      where: { id: chatMessage.id },
      include: {
        attachments: true,
      },
    });

    // Convert BigInt to string for serialization
    const serializedAttachments = attachments.map((att: any) => ({
      ...att,
      fileSize: att.fileSize ? (typeof att.fileSize === 'bigint' ? att.fileSize.toString() : att.fileSize) : null,
    }));

    // Broadcast message via Pusher for real-time delivery
    if (messageWithAttachments) {
      // Serialize BigInt before broadcasting
      const serializedMessage = {
        ...messageWithAttachments,
        attachments: (messageWithAttachments.attachments || []).map((att: any) => ({
          ...att,
          fileSize: att.fileSize ? (typeof att.fileSize === 'bigint' ? att.fileSize.toString() : att.fileSize) : null,
        })),
      };
      await broadcastChatMessage(id, serializedMessage);
    }

    return NextResponse.json({
      success: true,
      message: {
        ...chatMessage,
        attachments: serializedAttachments,
      },
    });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send chat message" },
      { status: 500 }
    );
  }
}









