import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Keep Prisma/exceljs on disk — Turbopack bundling a stale client or exceljs crypto polyfill 500s xlsx routes. */
  serverExternalPackages: ["@prisma/client", "prisma", "exceljs"],
};

export default nextConfig;
