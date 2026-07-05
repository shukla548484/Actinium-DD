import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/edge";
import { getSessionUserId } from "@/lib/auth/session";
import { buildAuthContext } from "@/lib/db/rbac";

export async function requireExternalApiAccess(): Promise<NextResponse | null> {
  if (!isAuthEnabled()) return null;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const ctx = await buildAuthContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const hasExternal =
    ctx.permissions.has("page.external.portal") ||
    ctx.permissions.has("page.external.class") ||
    ctx.permissions.has("page.external.flag") ||
    ctx.permissions.has("page.external.owner") ||
    ctx.permissions.has("page.external.auditor") ||
    ctx.permissions.has("page.yard.quote") ||
    ctx.roleCodes.some((c) =>
      ["VENDOR", "SERVICE_VENDOR", "MAKER", "CLASS", "FLAG", "OWNER", "OWNER_SUPDT", "AUDITOR"].includes(
        c,
      ),
    );

  if (!hasExternal) {
    return NextResponse.json({ error: "External portal access required." }, { status: 403 });
  }

  return null;
}

export async function getExternalSessionContext() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const [user, ctx] = await Promise.all([
    import("@/lib/db/employeeAuth").then((m) => m.getUserById(userId)),
    buildAuthContext(userId),
  ]);
  if (!user || !ctx) return null;
  return { user, ctx };
}
