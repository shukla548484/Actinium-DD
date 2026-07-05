#!/usr/bin/env tsx
/**
 * Apply migrations + seed to the database pointed at by DATABASE_URL or PRISMA_DATABASE_URL.
 *
 * Usage (Vercel / Prisma Postgres):
 *   DATABASE_URL="$PRISMA_DATABASE_URL" npm run db:deploy
 *
 * Or with .env containing PRISMA_DATABASE_URL:
 *   npm run db:deploy:vercel
 */
import { execSync } from "node:child_process";
import { ensureDatabaseUrl } from "../lib/db/resolveDatabaseUrl";

ensureDatabaseUrl();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL or PRISMA_DATABASE_URL must be set.");
  process.exit(1);
}

console.log("Running prisma migrate deploy…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });

console.log("Running prisma db seed…");
execSync("npx prisma db seed", { stdio: "inherit" });

console.log("Database deploy + seed complete.");
