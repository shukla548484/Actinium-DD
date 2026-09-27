import type { Prisma } from "@prisma/client";

export function dailyReportNumberPrefix(
  referenceCode: string | null | undefined,
  projectId: string,
): string {
  const source = referenceCode?.trim() || projectId.slice(0, 8);
  const normalized = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `DPR-${normalized || projectId.slice(0, 8).toUpperCase()}`;
}

export async function allocateDailyReportNumber(
  tx: Prisma.TransactionClient,
  project: { id: string; referenceCode: string | null },
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`daily-report:${project.id}`}))`;

  const prefix = dailyReportNumberPrefix(project.referenceCode, project.id);
  const existingNumbers = await tx.ddDailyReport.findMany({
    where: {
      dryDockProjectId: project.id,
      reportNumber: { startsWith: `${prefix}-` },
    },
    select: { reportNumber: true },
  });
  const nextSequence =
    existingNumbers.reduce((max, item) => {
      const match = /-(\d+)$/.exec(item.reportNumber);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;

  return `${prefix}-${String(nextSequence).padStart(4, "0")}`;
}
