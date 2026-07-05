import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "/projects";
  await enforceOfficePageAccess(pathname);
  return children;
}
