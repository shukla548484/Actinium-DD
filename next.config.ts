import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Keep Prisma on disk — avoids Turbopack bundling a stale generated client. */
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
