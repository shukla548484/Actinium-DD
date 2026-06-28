import { NextResponse } from "next/server";
import { createYardInvite, getProject, updateProject } from "@/lib/db/index";
import { buildYardInviteMailto } from "@/lib/mail/yardInviteMailto";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    yardName?: string;
    contactEmail?: string;
    preferredLocale?: "en" | "zh" | "ja";
  };

  if (!body.yardName?.trim()) {
    return NextResponse.json({ error: "Yard name is required." }, { status: 400 });
  }

  const invite = await createYardInvite({
    projectId: id,
    yardName: body.yardName.trim(),
    contactEmail: body.contactEmail?.trim(),
    preferredLocale: body.preferredLocale,
  });

  if (project.status === "draft") {
    await updateProject(id, { status: "tendering" });
  }

  const mailtoLink =
    invite.contactEmail &&
    buildYardInviteMailto({
      contactEmail: invite.contactEmail,
      yardName: invite.yardName,
      projectName: project.name,
      vesselName: project.vesselName,
      token: invite.token,
    });

  return NextResponse.json({ invite, mailtoLink: mailtoLink || null }, { status: 201 });
}
