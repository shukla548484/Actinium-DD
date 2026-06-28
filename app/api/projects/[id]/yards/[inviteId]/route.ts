import { NextResponse } from "next/server";
import { deleteYardInvite, getInvite, getProject, updateInviteStatus } from "@/lib/db/index";
import type { YardInviteStatus } from "@/lib/tender/types";

export const runtime = "nodejs";

const VALID_OWNER_STATUSES: YardInviteStatus[] = ["shortlisted", "accepted", "rejected"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; inviteId: string }> },
) {
  const { id: projectId, inviteId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const invite = await getInvite(inviteId);
  if (!invite || invite.projectId !== projectId) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const body = (await request.json()) as { status?: YardInviteStatus };

  if (!body.status || !VALID_OWNER_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_OWNER_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  await updateInviteStatus(inviteId, body.status);

  return NextResponse.json({ ok: true, status: body.status });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; inviteId: string }> },
) {
  const { id: projectId, inviteId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await deleteYardInvite(inviteId);
  if (!ok) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
