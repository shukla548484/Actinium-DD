/**
 * One-time / admin-safe cleanup: soft-delete duplicate dd_checklist_items
 * within each dry dock project (same title + category). Cross-project
 * identical template titles are left alone.
 *
 * Usage: npx tsx scripts/dedupe-dd-checklist.ts
 */
import {
  dedupeAllProjectChecklistItems,
  dedupeProjectChecklistItems,
} from "@/lib/superintendent/engine/dedupeChecklist";
import { prisma } from "@/lib/prisma";

async function main() {
  const projectId = process.argv.find((arg) => arg.startsWith("--project="))?.slice(
    "--project=".length,
  );

  if (projectId) {
    const result = await dedupeProjectChecklistItems(projectId);
    console.log(
      JSON.stringify(
        {
          dryDockProjectId: projectId,
          removed: result.removed,
          removedIds: result.removedIds,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await dedupeAllProjectChecklistItems();
  console.log(
    JSON.stringify(
      {
        projectsTouched: result.projectsTouched,
        removed: result.removed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
