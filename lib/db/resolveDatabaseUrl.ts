/** Prisma Postgres on Vercel exposes PRISMA_DATABASE_URL; schema.prisma reads DATABASE_URL. */
export function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL?.trim()) return;

  const prismaUrl = process.env.PRISMA_DATABASE_URL?.trim();
  if (prismaUrl) {
    process.env.DATABASE_URL = prismaUrl;
  }
}
