import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { getSessionUserId } from "@/lib/auth/session";
import { changeUserPassword } from "@/lib/db/employeeAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in with your employee ID to change password." }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must differ from current password." }, { status: 400 });
  }

  try {
    await changeUserPassword(userId, newPassword, currentPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to change password";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
