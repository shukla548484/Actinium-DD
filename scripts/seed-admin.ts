#!/usr/bin/env tsx
/** Seed only the ACT.1001 system admin on the target database (fast production bootstrap). */
import { ensureDatabaseUrl } from "../lib/db/resolveDatabaseUrl";
import { ensureSeedAdminUser } from "../lib/db/seedAdminUser";

ensureDatabaseUrl();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Set DATABASE_URL or PRISMA_DATABASE_URL");
    process.exit(1);
  }

  const result = await ensureSeedAdminUser();
  console.log(
    JSON.stringify(
      {
        ok: true,
        loginId: result.loginId,
        roleNo: result.roleNo,
        roleCode: result.roleCode,
        created: result.created,
        note: "Password is Admin@1001 unless changed",
      },
      null,
      2,
    ),
  );
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
