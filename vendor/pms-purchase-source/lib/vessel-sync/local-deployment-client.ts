/** Client-side mirror of server `DEPLOYMENT_ROLE` (injected via next.config `env`). */
export function isLocalDeploymentClient(): boolean {
  return (process.env.NEXT_PUBLIC_DEPLOYMENT_ROLE ?? "server").trim().toLowerCase() === "local";
}
