import { PrismaClient } from "@prisma/client";
import { seedJobCatalogLists } from "../lib/db/jobCatalog";
import { seedRbacCatalog } from "../lib/db/rbac";
import { ensureMasterCatalogSeeded } from "../lib/db/masterCatalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RBAC catalog (roles + permissions)…");
  const result = await seedRbacCatalog();
  console.log(`  ✓ ${result.roles} system roles`);
  console.log(`  ✓ ${result.permissions} permissions`);

  console.log("Seeding master spec catalog…");
  const count = await ensureMasterCatalogSeeded();
  console.log(`  ✓ ${count} master spec lines`);

  console.log("Seeding job catalog enum lists…");
  const lists = await seedJobCatalogLists();
  console.log(`  ✓ ${lists.listTypes} list types`);
  console.log(`  ✓ ${lists.items} list values`);

  if (process.env.SEED_JOB_CATALOG_PHASE1 === "1") {
    console.log("Seeding Phase 1 job catalog (templates + master jobs)…");
    const { seedJobCatalogPhase1 } = await import("../lib/mtil/db/seedJobCatalogPhase1");
    const catalog = await seedJobCatalogPhase1();
    console.log(`  ✓ ${catalog.templates} templates`);
    console.log(`  ✓ ${catalog.masterJobs} master jobs`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
