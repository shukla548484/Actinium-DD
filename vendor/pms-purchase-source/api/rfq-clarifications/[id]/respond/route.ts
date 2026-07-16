import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  respondToClarification,
  serializeClarificationForView,
  getClarificationById,
} from "@/lib/procurement/rfq-clarification-service";
import {
  canRespondToVesselClarification,
} from "@/lib/procurement/clarification-notifications";
import { getRequisitionCreatorAccessLevel } from "@/lib/procurement/clarification-responders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessLevel = user.designationAccessLevel || 0;
    const { id } = await context.params;

    const existing = await getClarificationById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const creatorAccessLevel =
      existing.requisition.createdBy?.designationAccessLevel ??
      (await getRequisitionCreatorAccessLevel(prisma, existing.requisitionId));

    if (
      creatorAccessLevel == null ||
      !canRespondToVesselClarification(accessLevel, creatorAccessLevel)
    ) {
      return NextResponse.json(
        {
          error:
            "You are not assigned to respond to this clarification. The task is routed to another officer rank on board.",
        },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let responseText = "";
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      responseText = String(form.get("responseText") || "").trim();
      files = form.getAll("files").filter((f): f is File => f instanceof File);
    } else {
      const body = await request.json();
      responseText = String(body.responseText || "").trim();
    }

    if (!responseText) {
      return NextResponse.json({ error: "Response text is required" }, { status: 400 });
    }

    const row = await respondToClarification({
      clarificationId: id,
      employeeId: user.id,
      accessLevel,
      responseText,
      files,
      request,
    });

    return NextResponse.json({
      clarification: serializeClarificationForView(row, "vessel"),
    });
  } catch (error: any) {
    console.error("[rfq-clarification respond]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit response" },
      { status: 400 }
    );
  }
}
