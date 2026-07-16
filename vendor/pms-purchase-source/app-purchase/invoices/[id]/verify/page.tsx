"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ActiniumLoader from "@/components/ActiniumLoader";
import { buildInvoiceVerificationUrl } from "@/lib/purchase/invoice-verification-url";

export default function InvoiceVerificationRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = params?.id as string | undefined;
  const fromNotification = searchParams.get("from") === "notification";

  useEffect(() => {
    if (!invoiceId) {
      router.replace("/purchase/invoices");
      return;
    }
    router.replace(
      buildInvoiceVerificationUrl(invoiceId, {
        fromNotification,
        mode: "approve",
      })
    );
  }, [invoiceId, fromNotification, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <ActiniumLoader size="lg" />
    </div>
  );
}
