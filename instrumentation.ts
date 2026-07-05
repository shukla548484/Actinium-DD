export async function register() {
  const { ensureDatabaseUrl } = await import("@/lib/db/resolveDatabaseUrl");
  ensureDatabaseUrl();
}
