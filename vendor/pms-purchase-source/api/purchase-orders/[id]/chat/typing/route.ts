/**
 * Typing Indicator API
 * POST /api/purchase-orders/[id]/chat/typing
 * Broadcast typing indicator via Pusher
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { broadcastTypingIndicator } from "@/lib/pusher-server";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
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
    const body = await request.json();
    const { userId, userName, isTyping } = body;

    // Broadcast typing indicator
    await broadcastTypingIndicator(
      id,
      userId || currentUser.id,
      userName || `${currentUser.firstName} ${currentUser.lastName}`,
      isTyping
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error broadcasting typing indicator:", error);
    return NextResponse.json(
      { error: "Failed to broadcast typing indicator" },
      { status: 500 }
    );
  }
}



