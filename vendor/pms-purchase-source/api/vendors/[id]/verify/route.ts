import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext } from "@/lib/api-security";
import prisma from "@/lib/prisma";
import { resolveMasterCompanyIdForUser } from "@/lib/vendor-company-scope";
import {
  canVerifyVendorRegistration,
  VENDOR_VERIFICATION_STATUS,
} from "@/lib/vendor-verification";
import { logVendorRegistrationAudit } from "@/lib/vendor-registration-audit";
import { sendVendorRegistrationWelcomeEmail } from "@/lib/send-vendor-registration-invite-email";

const postHandler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id?: string }
) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "Vendor ID required" }, { status: 400 });
    }

    const accessLevel = context.user.designationAccessLevel ?? 0;
    if (!canVerifyVendorRegistration(accessLevel)) {
      return NextResponse.json(
        { error: "Only purchasers (access levels 32–33) or administrators (50, 99, 100) can verify vendor registrations" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      notes?: string;
      action?: "confirm" | "reject";
    };
    const action = body.action === "reject" ? "reject" : "confirm";
    const notes = String(body.notes ?? "").trim() || null;

    const masterCompanyId = await resolveMasterCompanyIdForUser(context.user?.company);
    const vendor = await prisma.vendor.findUnique({ where: { id } });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (masterCompanyId && vendor.masterCompanyId && vendor.masterCompanyId !== masterCompanyId) {
      return NextResponse.json(
        { error: "This vendor belongs to another company" },
        { status: 403 }
      );
    }

    if (!vendor.registrationComplete) {
      return NextResponse.json(
        { error: "Vendor has not completed registration yet" },
        { status: 400 }
      );
    }

    if (vendor.verificationStatus === VENDOR_VERIFICATION_STATUS.VERIFIED && action === "confirm") {
      return NextResponse.json({ error: "Vendor is already verified" }, { status: 400 });
    }

    const now = new Date();
    const newStatus =
      action === "reject"
        ? VENDOR_VERIFICATION_STATUS.REJECTED
        : VENDOR_VERIFICATION_STATUS.VERIFIED;

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        verificationStatus: newStatus,
        verifiedAt: action === "confirm" ? now : null,
        verifiedById: action === "confirm" ? context.user.id : null,
        verificationNotes: notes,
        isActive: action === "confirm" ? true : vendor.isActive,
      },
    });

    if (action === "confirm") {
      try {
        await sendVendorRegistrationWelcomeEmail({
          email: vendor.primaryEmail,
          vendorId: vendor.id,
          vendorName: vendor.name,
        });
      } catch (emailError) {
        console.error("Failed to send vendor welcome email:", emailError);
      }
    }

    await logVendorRegistrationAudit({
      request,
      action:
        action === "reject"
          ? "VENDOR_VERIFICATION_REJECTED"
          : "VENDOR_VERIFICATION_CONFIRMED",
      vendorId: vendor.id,
      vendorName: vendor.name,
      companyId: vendor.masterCompanyId ?? masterCompanyId,
      actorEmployeeId: context.user.id,
      actorRole: String(accessLevel),
      oldValue: {
        verificationStatus: vendor.verificationStatus,
        verifiedAt: vendor.verifiedAt,
        verifiedById: vendor.verifiedById,
      },
      newValue: {
        verificationStatus: updated.verificationStatus,
        verifiedAt: updated.verifiedAt,
        verifiedById: updated.verifiedById,
        verificationNotes: updated.verificationNotes,
      },
      remarks: notes ?? undefined,
      activityDescription:
        action === "reject"
          ? `Rejected vendor registration: ${vendor.name}`
          : `Verified vendor registration: ${vendor.name}`,
      page: `/purchase/vendor-management/view/${vendor.id}`,
      metadata: {
        primaryEmail: vendor.primaryEmail,
        verifierAccessLevel: accessLevel,
      },
    });

    return NextResponse.json({
      success: true,
      vendor: updated,
      message:
        action === "reject"
          ? "Vendor registration rejected"
          : "Vendor registration verified — portal access enabled",
    });
  } catch (error) {
    console.error("POST /api/vendors/[id]/verify:", error);
    return NextResponse.json({ error: "Failed to verify vendor" }, { status: 500 });
  }
};

export const POST = secureApiRoute(postHandler, {
  requireAuth: true,
  allowedMethods: ["POST"],
});
