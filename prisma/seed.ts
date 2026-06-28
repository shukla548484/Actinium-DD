import { PrismaClient } from "@prisma/client";
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
