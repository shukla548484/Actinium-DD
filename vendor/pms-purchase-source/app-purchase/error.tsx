"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { monitorError } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";

interface PurchaseErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PurchaseError({ error, reset }: PurchaseErrorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isQuoteComparisonPage =
    pathname?.includes("/purchase/requisitions/") && pathname?.includes("/quotes");

  useEffect(() => {
    console.error("Purchase section error:", error);
    monitorError(error);
  }, [error]);

  const handleReload = () => {
    reset();
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md bg-background border rounded-lg shadow-sm p-6 text-center">
        <div className="flex justify-center mb-4 text-warning">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-semibold mb-2">
          {isQuoteComparisonPage
            ? "Quote comparison page failed to load"
            : "Connection seems slow or interrupted"}
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {isQuoteComparisonPage
            ? "We could not load the full quote cost comparison for this requisition. This is usually caused by a temporary loading or network problem. Please try again. If the problem continues, contact your administrator."
            : "It looks like the network is slow or the page did not load correctly. Please check your internet connection and try again. If the problem continues, contact your administrator."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={handleGoBack}>
            Go back
          </Button>
          <Button onClick={handleReload}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
