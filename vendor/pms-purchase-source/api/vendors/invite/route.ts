import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext, sanitizeInput } from "@/lib/api-security";
import prisma from "@/lib/prisma";
import { sendVendorRegistrationInviteEmail } from "@/lib/send-vendor-registration-invite-email";
import { generateNextVendorId } from "@/lib/vendor-id-generator";
import {
  isValidVendorEmail,
  normalizeVendorEmail,
} from "@/lib/vendor-registration";
import { resolveMasterCompanyIdForUser } from "@/lib/vendor-company-scope";
import { findVendorForCompanyInvite } from "@/lib/vendor-email-lookup";
import { logVendorRegistrationAudit } from "@/lib/vendor-registration-audit";

const PENDING_VENDOR_NAME = "Pending Registration";

async function postHandler(request: NextRequest, context: SecureRequestContext) {
  try {
    const body = sanitizeInput(await request.json()) as { email?: string; message?: string };
    const email = normalizeVendorEmail(String(body.email ?? ""));

    if (!email || !isValidVendorEmail(email)) {
      return NextResponse.json({ error: "Enter a valid vendor email address" }, { status: 400 });
    }

    const masterCompanyId = await resolveMasterCompanyIdForUser(context.user?.company);
    if (!masterCompanyId) {
      return NextResponse.json(
        { error: "Could not determine your company for vendor invitation" },
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

    const existingForCompany = await findVendorForCompanyInvite(email, masterCompanyId);

    let invitedVendorId: string;

    if (existingForCompany) {
      if (existingForCompany.registrationComplete) {
        return NextResponse.json(
          { error: "A registered vendor with this email already exists for your company" },
          { status: 409 }
        );
      }

      await prisma.vendor.update({
        where: { id: existingForCompany.id },
        data: {
          masterCompanyId,
          invitedAt: new Date(),
          invitedById: context.user?.id ?? null,
          registrationComplete: false,
          isActive: true,
        },
      });
      invitedVendorId = existingForCompany.id;
    } else {
      const vendorId = await generateNextVendorId();
      const created = await prisma.vendor.create({
        data: {
          vendorId,
          name: PENDING_VENDOR_NAME,
          primaryEmail: email,
          country: "TBD",
          serviceTypes: [],
          serviceCountries: [],
          masterCompanyId,
          invitedAt: new Date(),
          invitedById: context.user?.id ?? null,
          registrationComplete: false,
          isActive: true,
          onboardingStep: 0,
          onboardingData: {},
        },
      });
      invitedVendorId = created.id;
    }

    const customMessage = String(body.message ?? "").trim();

    await sendVendorRegistrationInviteEmail({
      email,
      vendorId: invitedVendorId,
      companyName: company.name,
      customMessage,
    });

    await logVendorRegistrationAudit({
      request,
      action: "VENDOR_INVITED",
      vendorId: invitedVendorId,
      vendorName: email,
      companyId: masterCompanyId,
      actorEmployeeId: context.user?.id,
      actorRole: String(context.user?.designationAccessLevel ?? ""),
      newValue: { email, masterCompanyId, invitedAt: new Date().toISOString() },
      activityDescription: `Invited vendor ${email} for registration (${company.name})`,
      page: "/purchase/vendor-management",
      metadata: { email, masterCompanyId },
    });

    return NextResponse.json({
      success: true,
      message: `Registration invitation sent to ${email}`,
    });
  } catch (error) {
    console.error("POST /api/vendors/invite:", error);
    return NextResponse.json({ error: "Failed to send vendor invitation" }, { status: 500 });
  }
}

export const POST = secureApiRoute(postHandler);
