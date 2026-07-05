"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { crewPagePermissionForPath } from "@/lib/shipAccess/crewPages";

type Props = { children: React.ReactNode };

function CrewPageGuardInner({ children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { isVesselCrew?: boolean; assignedPageKeys?: string[] }
          | undefined;
        if (!user?.isVesselCrew) return;

        const search = searchParams.toString();
        const permissionKey = crewPagePermissionForPath(pathname, search);
        if (!permissionKey) return;

        const assigned = new Set(user.assignedPageKeys ?? []);
        if (!assigned.has(permissionKey)) {
          router.replace("/ship-access");
        }
      })
      .catch(() => {});
  }, [pathname, router, searchParams]);

  return children;
}

/** Client guard — redirects crew away from unassigned ship-access pages. */
export function CrewPageGuard({ children }: Props) {
  return (
    <Suspense fallback={children}>
      <CrewPageGuardInner>{children}</CrewPageGuardInner>
    </Suspense>
  );
}
