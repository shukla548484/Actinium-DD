import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext } from "@/lib/api-security";
import prisma from "@/lib/prisma";
import {
  isValidVendorEmail,
  normalizeVendorEmail,
} from "@/lib/vendor-registration";
import { resolveMasterCompanyIdForUser } from "@/lib/vendor-company-scope";
import { logVendorRegistrationAudit } from "@/lib/vendor-registration-audit";
import { sendVendorRegistrationInviteEmail } from "@/lib/send-vendor-registration-invite-email";

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

    const masterCompanyId = await resolveMasterCompanyIdForUser(context.user?.company);
    if (!masterCompanyId) {
      return NextResponse.json(
        { error: "Could not determine your company for vendor invitation" },
        { status: 400 }
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        primaryEmail: true,
        masterCompanyId: true,
        registrationComplete: true,
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (vendor.registrationComplete) {
      return NextResponse.json(
        { error: "Vendor has already completed registration" },
        { status: 400 }
      );
    }

    if (vendor.masterCompanyId && vendor.masterCompanyId !== masterCompanyId) {
      return NextResponse.json(
        { error: "This vendor invitation belongs to another company" },
        { status: 403 }
      );
    }

    const email = normalizeVendorEmail(vendor.primaryEmail);
    if (!email || !isValidVendorEmail(email)) {
      return NextResponse.json(
        { error: "Vendor does not have a valid email address for registration" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: masterCompanyId },
      select: { id: true, name: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        masterCompanyId,
        invitedAt: new Date(),
        invitedById: context.user?.id ?? null,
        isActive: true,
      },
    });

    await sendVendorRegistrationInviteEmail({
      email,
      vendorId: vendor.id,
      companyName: company.name,
    });

    await logVendorRegistrationAudit({
      request,
      action: "VENDOR_INVITE_RESENT",
      vendorId: vendor.id,
      vendorName: vendor.name,
      companyId: masterCompanyId,
      actorEmployeeId: context.user?.id,
      actorRole: String(context.user?.designationAccessLevel ?? ""),
      newValue: { email, masterCompanyId, invitedAt: new Date().toISOString() },
      activityDescription: `Resent registration link to ${email} (${company.name})`,
      page: "/purchase/vendor-management",
      metadata: { email, masterCompanyId, resent: true },
    });

    return NextResponse.json({
      success: true,
      message: `Registration link resent to ${email}`,
    });
  } catch (error) {
    console.error("POST /api/vendors/[id]/resend-registration:", error);
    return NextResponse.json(
      { error: "Failed to resend registration link" },
      { status: 500 }
    );
  }
};

export const POST = secureApiRoute(postHandler, {
  requireAuth: true,
  allowedMethods: ["POST"],
});
