"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect: Seafarer Application Portal lives under Crewing, not Purchase.
 * Any old or external link to /purchase/seafarer-application goes to /crewing/applicant-portal.
 */
export default function PurchaseSeafarerApplicationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/crewing/applicant-portal");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px] text-foreground">
      Redirecting to Seafarer Application Portal…
    </div>
  );
}
